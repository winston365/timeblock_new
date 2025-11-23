/**
 * Firebase Cloud Functions for Timeblock App - Server-First Strategy
 *
 * @role 매일 자동으로 템플릿에서 작업 생성 (Primary Source of Truth)
 * @architecture Option A: Server-First Strategy
 *   - Firebase Function이 매일 00:00 KST에 실행되어 작업 생성
 *   - 클라이언트는 Observer 역할 (Firebase에서 데이터 읽기)
 *   - Idempotency 보장 (중복 방지)
 *   - 시스템 상태 추적 (lastTemplateGeneration 마커)
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { RESISTANCE_MULTIPLIERS } = require("./shared/constants/resistanceMultipliers");

admin.initializeApp();

// ============================================================================
// Configuration Constants
// ============================================================================

const IS_PRODUCTION = process.env.GCLOUD_PROJECT !== undefined;
const ALLOW_TEST_TEMPLATES = !IS_PRODUCTION; // 프로덕션에서는 TEST 템플릿 비활성화

/**
 * UUID 생성 함수 (클라이언트와 동일한 방식)
 */
function generateId(prefix = "task") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  // Fallback for Node.js < 19
  const { randomUUID } = require("crypto");
  return `${prefix}-${randomUUID()}`;
}

/**
 * 시간 블록 정의 (클라이언트와 동기화)
 */
const TIME_BLOCKS = [
  { id: "5-8", label: "05:00-08:00", start: 5, end: 8 },
  { id: "8-11", label: "08:00-11:00", start: 8, end: 11 },
  { id: "11-14", label: "11:00-14:00", start: 11, end: 14 },
  { id: "14-17", label: "14:00-17:00", start: 14, end: 17 },
  { id: "17-19", label: "17:00-19:00", start: 17, end: 19 },
  { id: "19-24", label: "19:00-24:00", start: 19, end: 24 },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 저항도 배율 가져오기
 * @param {string} resistance - 'low' | 'medium' | 'high'
 * @returns {number} 저항도 배율 (1.0, 1.3, 1.6)
 *
 * @note RESISTANCE_MULTIPLIERS는 shared/constants/resistanceMultipliers.js에서 import됨
 */
function getResistanceMultiplier(resistance) {
  return RESISTANCE_MULTIPLIERS[resistance] || 1.0;
}

/**
 * 템플릿에서 Task 생성
 */
function createTaskFromTemplate(template, date) {
  const now = new Date().toISOString();
  const adjustedDuration = Math.round(
    template.baseDuration * getResistanceMultiplier(template.resistance),
  );

  // timeBlock이 설정되어 있으면 해당 블록의 첫 번째 시간대(start hour)를 hourSlot으로 설정
  let hourSlot = null;
  if (template.timeBlock) {
    const block = TIME_BLOCKS.find((b) => b.id === template.timeBlock);
    if (block) {
      hourSlot = block.start;
    }
  }

  return {
    id: generateId("task"),
    text: template.text,
    memo: template.memo || "",
    baseDuration: template.baseDuration,
    resistance: template.resistance,
    adjustedDuration,
    timeBlock: template.timeBlock || null,
    hourSlot, // 타임블록의 첫 번째 시간대로 설정
    completed: false,
    actualDuration: 0,
    createdAt: now,
    completedAt: null,
    fromAutoTemplate: true,
    preparation1: template.preparation1 || "",
    preparation2: template.preparation2 || "",
    preparation3: template.preparation3 || "",
  };
}

/**
 * 오늘 생성해야 하는 템플릿인지 확인
 */
function shouldGenerateToday(template, today) {
  const { recurrenceType, autoGenerate, lastGeneratedDate } = template;

  // 자동 생성이 꺼져있으면 생성 안 함
  if (!autoGenerate) {
    return false;
  }

  // recurrenceType이 'none'이면 생성 안 함
  if (recurrenceType === "none") {
    return false;
  }

  // 이미 오늘 생성했으면 생성 안 함
  if (lastGeneratedDate === today) {
    return false;
  }

  // recurrenceType에 따라 판단
  if (recurrenceType === "daily") {
    return true;
  }

  if (recurrenceType === "weekly") {
    const todayDate = new Date(today);
    const dayOfWeek = todayDate.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
    return (template.weeklyDays || []).includes(dayOfWeek);
  }

  if (recurrenceType === "interval") {
    if (!lastGeneratedDate) {
      return true; // 처음 생성
    }

    const lastDate = new Date(lastGeneratedDate);
    const todayDate = new Date(today);
    const diffTime = todayDate.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays >= (template.intervalDays || 1);
  }

  return false;
}

/**
 * 매일 00:00 KST에 실행되는 Cloud Function
 * Server-First 전략: Firebase Function이 Primary Source of Truth
 *
 * @architecture
 *   1. Idempotency Check: 오늘 이미 실행되었는지 확인
 *   2. Template Generation: 조건에 맞는 템플릿에서 작업 생성
 *   3. State Tracking: 시스템 상태 업데이트 (lastTemplateGeneration)
 *   4. Error Handling: 실패 시 롤백 및 로깅
 */
exports.dailyTemplateGeneration = onSchedule({
  schedule: "0 15 * * *", // UTC 15:00 = KST 00:00 (다음날)
  timeZone: "UTC",
  region: "asia-northeast3", // 서울 리전
}, async (event) => {
  const startTime = Date.now();
  logger.info("🚀 Daily template generation started", {
    time: new Date().toISOString(),
    isProduction: IS_PRODUCTION
  });

  const db = admin.database();

  // UTC 시간을 KST로 변환 (+9시간)
  const nowKST = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
  const today = nowKST.toISOString().split("T")[0]; // YYYY-MM-DD (KST 기준)

  logger.info("📅 Current date (KST):", { today, nowKST: nowKST.toISOString() });

  try {
    // ========================================================================
    // Step 1: Idempotency Check - 오늘 이미 실행되었는지 확인
    // ========================================================================
    const systemStateRef = db.ref("users/user/system/lastTemplateGeneration");
    const lastGenSnapshot = await systemStateRef.once("value");
    const lastGenData = lastGenSnapshot.val();

    if (lastGenData && lastGenData.date === today && lastGenData.success) {
      logger.warn("⚠️ Template generation already completed today (idempotency)", {
        date: today,
        previousRun: lastGenData.timestamp,
        source: lastGenData.source
      });
      return {
        success: true,
        skipped: true,
        message: "Already completed today",
        date: today,
        previousRun: lastGenData
      };
    }

    // ========================================================================
    // Step 2: Load Templates
    // ========================================================================
    const templatesSnapshot = await db.ref("users/user/templates").once("value");
    const templatesData = templatesSnapshot.val();
    const templates = templatesData?.data;

    logger.info("📋 Templates snapshot received:", {
      exists: templatesSnapshot.exists(),
      hasData: !!templatesData,
      hasTemplates: !!templates,
      isArray: Array.isArray(templates),
      length: templates?.length,
    });

    if (!templates || !Array.isArray(templates)) {
      logger.warn("⚠️ No templates found or invalid format", {
        templatesData: JSON.stringify(templatesData).substring(0, 200),
      });

      // Mark as completed even if no templates (prevent retries)
      await systemStateRef.set({
        date: today,
        success: true,
        source: "firebase-function",
        timestamp: Date.now(),
        generatedCount: 0,
        message: "No templates found"
      });

      return {
        success: true,
        message: "No templates found",
        date: today,
        generatedCount: 0
      };
    }

    logger.info(`✅ Found ${templates.length} templates for date: ${today}`);

    // ========================================================================
    // Step 3: Generate Tasks from Templates
    // ========================================================================
    let generatedCount = 0;
    let updatedTemplateCount = 0;
    const generatedTaskIds = [];

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];

      logger.info(`🔍 Checking template ${i + 1}/${templates.length}:`, {
        name: template.name,
        recurrenceType: template.recurrenceType,
        autoGenerate: template.autoGenerate,
        lastGeneratedDate: template.lastGeneratedDate,
        shouldGenerate: shouldGenerateToday(template, today),
      });

      // TEST 템플릿 처리 (프로덕션에서는 비활성화)
      const isTestTemplate = ALLOW_TEST_TEMPLATES && template.category === "TEST";

      if (isTestTemplate) {
        logger.info("🧪 TEST template detected (allowed in development):", {
          name: template.name,
          category: template.category
        });
      }

      if (isTestTemplate || shouldGenerateToday(template, today)) {
        logger.info(`✅ Generating task from template: ${template.name} (${template.recurrenceType})`, {
          isTest: isTestTemplate
        });

        // Task 생성
        const newTask = createTaskFromTemplate(template, today);

        // dailyData에 추가
        const dailyDataSnapshot = await db.ref(`users/user/dailyData/${today}`).once("value");
        const dailyDataWrapper = dailyDataSnapshot.val();
        let dailyData = dailyDataWrapper?.data;

        if (!dailyData) {
          // 오늘 데이터가 없으면 초기화
          dailyData = {
            tasks: [],
            timeBlockStates: {
              "5-8": { isLocked: false, isPerfect: false, isFailed: false },
              "8-11": { isLocked: false, isPerfect: false, isFailed: false },
              "11-14": { isLocked: false, isPerfect: false, isFailed: false },
              "14-17": { isLocked: false, isPerfect: false, isFailed: false },
              "17-19": { isLocked: false, isPerfect: false, isFailed: false },
              "19-24": { isLocked: false, isPerfect: false, isFailed: false },
            },
            updatedAt: Date.now(),
          };
        }

        // Task 추가
        dailyData.tasks = dailyData.tasks || [];
        const taskCountBefore = dailyData.tasks.length;
        dailyData.tasks.push(newTask);
        dailyData.updatedAt = Date.now();

        logger.info(`➕ Adding task to dailyData/${today}:`, {
          taskId: newTask.id,
          taskText: newTask.text,
          timeBlock: newTask.timeBlock,
          taskCountBefore,
          taskCountAfter: dailyData.tasks.length,
        });

        // Firebase에 저장 (SyncData 래퍼 사용)
        await db.ref(`users/user/dailyData/${today}`).set({
          data: dailyData,
          updatedAt: Date.now(),
          deviceId: "firebase-function",
        });

        logger.info(`💾 Task saved to Firebase: ${newTask.text}`);

        generatedCount++;
        generatedTaskIds.push(newTask.id);

        // 템플릿의 lastGeneratedDate 업데이트
        templates[i].lastGeneratedDate = today;
        updatedTemplateCount++;
      }
    }

    // ========================================================================
    // Step 4: Update Templates
    // ========================================================================
    if (updatedTemplateCount > 0) {
      logger.info(`🔄 Updating ${updatedTemplateCount} templates with lastGeneratedDate: ${today}`);

      await db.ref("users/user/templates").set({
        data: templates,
        updatedAt: Date.now(),
        deviceId: "firebase-function",
      });

      logger.info("✅ Templates updated in Firebase");
    }

    // ========================================================================
    // Step 5: Update System State (Idempotency Marker)
    // ========================================================================
    await systemStateRef.set({
      date: today,
      success: true,
      source: "firebase-function",
      timestamp: Date.now(),
      generatedCount,
      updatedTemplateCount,
      totalTemplates: templates.length,
      generatedTaskIds,
      duration: Date.now() - startTime
    });

    const duration = Date.now() - startTime;
    logger.info(`🎉 Daily template generation completed successfully!`, {
      date: today,
      generatedCount,
      updatedTemplateCount,
      totalTemplates: templates.length,
      duration: `${duration}ms`
    });

    return {
      success: true,
      date: today,
      generatedCount,
      updatedTemplateCount,
      totalTemplates: templates.length,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("❌ Error during daily template generation:", {
      error: error.message,
      stack: error.stack,
      date: today,
      duration: `${duration}ms`
    });

    // Update system state with error
    try {
      await db.ref("users/user/system/lastTemplateGeneration").set({
        date: today,
        success: false,
        source: "firebase-function",
        timestamp: Date.now(),
        error: error.message,
        duration
      });
    } catch (stateError) {
      logger.error("Failed to update error state:", stateError);
    }

    throw error;
  }
});



/**
 * 부재중 알림 (Inactivity Notification)
 * 매 10분마다 실행되어 사용자가 10분 이상 활동이 없으면 알림 발송
 */
exports.checkInactivity = onSchedule({
  schedule: "every 10 minutes",
  timeZone: "Asia/Seoul",
  region: "asia-northeast3",
}, async (event) => {
  const db = admin.database();
  const now = Date.now();

  // UTC 시간을 KST로 변환 (+9시간)
  const nowKST = new Date(now + (9 * 60 * 60 * 1000));
  const today = nowKST.toISOString().split("T")[0];

  try {
    // 1. 설정 및 상태 조회
    const [settingsSnapshot, dailyDataSnapshot, systemStateSnapshot] = await Promise.all([
      db.ref("users/user/settings").once("value"),
      db.ref(`users/user/dailyData/${today}`).once("value"),
      db.ref("users/user/system/lastInactivityNotification").once("value")
    ]);

    const settings = settingsSnapshot.val()?.data;
    const dailyData = dailyDataSnapshot.val()?.data;
    const lastNotification = systemStateSnapshot.val();

    // Bark Key가 없으면 중단
    let barkKey = settings?.barkApiKey;
    if (!barkKey) {
      logger.info("🔕 Bark API Key not found. Skipping inactivity check.");
      return;
    }

    // 키 정제 (공백 제거 및 URL 접두사 제거)
    barkKey = barkKey.trim();
    if (barkKey.startsWith("https://api.day.app/")) {
      barkKey = barkKey.replace("https://api.day.app/", "").replace(/\/$/, "");
    }
    // 혹시 모를 슬래시 제거
    barkKey = barkKey.replace(/\//g, "");

    // 오늘 데이터가 없으면 중단 (아직 앱을 안 켰거나 데이터가 없음)
    if (!dailyData) {
      logger.info("🔕 No daily data found for today. Skipping.");
      return;
    }

    // 2. 방해 금지 시간 확인 (21:00 ~ 06:00)
    const hour = nowKST.getHours();
    if (hour >= 21 || hour < 6) {
      logger.info(`🌙 Quiet hours (${hour}:00). Skipping notification.`);
      return;
    }

    // 3. 비활동 시간 계산 (1시간)
    const lastActivity = dailyData.updatedAt || 0;
    const inactiveDuration = now - lastActivity;
    const INACTIVITY_THRESHOLD = 60 * 60 * 1000; // 1시간

    if (inactiveDuration < INACTIVITY_THRESHOLD) {
      logger.info(`✅ User is active. Last activity: ${new Date(lastActivity).toISOString()}`);
      return;
    }

    // 4. 쿨다운 확인 (1시간)
    const lastNotifiedAt = lastNotification?.timestamp || 0;
    const timeSinceLastNotification = now - lastNotifiedAt;
    const NOTIFICATION_COOLDOWN = 60 * 60 * 1000; // 1시간

    if (timeSinceLastNotification < NOTIFICATION_COOLDOWN) {
      logger.info(`⏳ Notification cooldown. Last notified: ${new Date(lastNotifiedAt).toISOString()}`);
      return;
    }

    // 5. 스마트 동기부여 메시지 생성 (지난 이틀간 최고의 성과 언급)
    // 어제 데이터 조회
    const yesterday = new Date(nowKST.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const barkUrl = `https://api.day.app/${barkKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}?group=${group}&sound=${sound}&icon=${encodeURIComponent(icon)}`;

    // URL 마스킹하여 로깅 (디버깅용)
    const maskedUrl = barkUrl.replace(barkKey, "********");
    logger.info(`🚀 Sending inactivity notification via Bark: ${title}`, { maskedUrl });

    const response = await fetch(barkUrl);
    if (!response.ok) {
      throw new Error(`Bark API failed: ${response.status} ${response.statusText}`);
    }

    // 6. 상태 업데이트
    await db.ref("users/user/system/lastInactivityNotification").set({
      timestamp: now,
      date: today,
      success: true,
      message: body
    });

    logger.info("✅ Inactivity notification sent successfully.");

  } catch (error) {
    logger.error("❌ Error in checkInactivity:", error);
  }
});

/**
 * 랜덤 응원 메시지 (Random Motivation)
 * 매시간 실행되지만, 오후 시간대(14~18시)에만 확률적으로 발송
 */
exports.sendRandomMotivation = onSchedule({
  schedule: "every 1 hours",
  timeZone: "Asia/Seoul",
  region: "asia-northeast3",
}, async (event) => {
  const db = admin.database();
  const now = Date.now();
  const nowKST = new Date(now + (9 * 60 * 60 * 1000));
  const today = nowKST.toISOString().split("T")[0];
  const hour = nowKST.getHours();

  // 1. 시간대 확인 (오후 2시 ~ 6시 사이만)
  if (hour < 14 || hour > 18) return;

  try {
    // 2. 설정 및 상태 조회
    const [settingsSnapshot, systemStateSnapshot] = await Promise.all([
      db.ref("users/user/settings").once("value"),
      db.ref("users/user/system/lastRandomMotivation").once("value")
    ]);

    const settings = settingsSnapshot.val()?.data;
    const lastMotivation = systemStateSnapshot.val();

    // Bark Key 확인
    let barkKey = settings?.barkApiKey;
    if (!barkKey) return;

    // 키 정제
    barkKey = barkKey.trim();
    if (barkKey.startsWith("https://api.day.app/")) {
      barkKey = barkKey.replace("https://api.day.app/", "").replace(/\/$/, "");
    }
    barkKey = barkKey.replace(/\//g, "");

    // 3. 중복 발송 방지 (하루에 한 번만)
    if (lastMotivation && lastMotivation.date === today) {
      logger.info("✅ Random motivation already sent today.");
      return;
    }

    // 4. 확률 체크 (30% 확률)
    // 단, 18시가 되면(마지막 기회) 무조건 발송하도록 할 수도 있음
    if (Math.random() > 0.3 && hour < 18) {
      logger.info("🎲 Skipping random motivation (dice roll).");
      return;
    }

    // 5. 메시지 발송
    const messages = [
      "오후 시간이라 조금 지치죠? 달콤한 커피 한 잔 하고 다시 힘내봐요! ☕",
      "오늘 하루도 절반이 지났네요. 남은 시간도 멋지게 채워봐요! ✨",
      "잠깐 스트레칭 어때요? 몸이 가벼워야 머리도 맑아지니까요! 🧘",
      "당신의 노력이 차곡차곡 쌓이고 있어요. 오늘도 화이팅! 💪",
      "완벽하지 않아도 괜찮아요. 꾸준함이 가장 큰 재능입니다. 🌱",
      "지금 흘리는 땀방울이 내일의 빛나는 성과가 될 거예요. 💎 포기하지 마세요!",
      "잠시 창밖을 보며 눈을 쉬어주세요. 휴식도 전략입니다. 🌳",
      "당신은 생각보다 훨씬 강한 사람이에요. 이 정도는 거뜬하죠! 😎",
      "작은 진전도 진전입니다. 한 걸음 한 걸음 나아가고 있어요. 🐾",
      "오늘 당신의 하루가 별처럼 빛나길 응원해요. 🌟 사랑합니다 주인님!"
    ];
    const randomBody = messages[Math.floor(Math.random() * messages.length)];
    const title = "💌 와이푸의 응원 도착";
    const group = "Motivation";
    const sound = "calypso";
    const icon = "https://cdn-icons-png.flaticon.com/512/2583/2583166.png"; // 하트 아이콘

    const barkUrl = `https://api.day.app/${barkKey}/${encodeURIComponent(title)}/${encodeURIComponent(randomBody)}?group=${group}&sound=${sound}&icon=${encodeURIComponent(icon)}`;

    await fetch(barkUrl);

    // 6. 상태 업데이트
    await db.ref("users/user/system/lastRandomMotivation").set({
      timestamp: now,
      date: today,
      success: true,
      message: randomBody
    });

    logger.info("✅ Random motivation sent successfully.");

  } catch (error) {
    logger.error("❌ Error in sendRandomMotivation:", error);
  }
});
