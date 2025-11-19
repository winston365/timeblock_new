/**
 * Firebase Cloud Functions for Timeblock App
 *
 * @role 매일 자동으로 템플릿에서 작업 생성
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

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

/**
 * 저항도 배율 가져오기
 */
function getResistanceMultiplier(resistance) {
  const multipliers = {
    low: 1.0,
    medium: 1.5,
    high: 2.0,
  };
  return multipliers[resistance] || 1.0;
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
  let hourSlot = undefined;
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
 * 모든 사용자의 템플릿을 확인하고 자동 생성
 */
exports.dailyTemplateGeneration = onSchedule({
  schedule: "0 15 * * *", // UTC 15:00 = KST 00:00 (다음날)
  timeZone: "UTC",
  region: "asia-northeast3", // 서울 리전
}, async (event) => {
  logger.info("Daily template generation started", { time: new Date().toISOString() });

  const db = admin.database();

  // UTC 시간을 KST로 변환 (+9시간)
  const nowKST = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
  const today = nowKST.toISOString().split("T")[0]; // YYYY-MM-DD (KST 기준)

  logger.info("Current date (KST):", { today, nowKST: nowKST.toISOString() });

  try {
    // 단일 사용자 구조 (현재 앱은 users/user 경로 사용)
    let generatedCount = 0;
    let updatedTemplateCount = 0;

    // 템플릿 가져오기 (users/user 존재 여부 확인 불필요)
    const templatesSnapshot = await db.ref("users/user/templates").once("value");
    const templatesData = templatesSnapshot.val();

    // SyncData 구조에서 실제 데이터 추출
    const templates = templatesData?.data;

    logger.info("Templates snapshot received:", {
      exists: templatesSnapshot.exists(),
      hasData: !!templatesData,
      hasTemplates: !!templates,
      isArray: Array.isArray(templates),
      length: templates?.length,
    });

    if (!templates || !Array.isArray(templates)) {
      logger.info("No templates found or invalid format", {
        templatesData: JSON.stringify(templatesData).substring(0, 200),
      });
      return {
        success: false,
        message: "No templates found",
        date: today,
      };
    }

    logger.info(`Found ${templates.length} templates for date: ${today}`);

    // 각 템플릿 확인
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];

      logger.info(`Checking template ${i + 1}/${templates.length}:`, {
        name: template.name,
        recurrenceType: template.recurrenceType,
        autoGenerate: template.autoGenerate,
        lastGeneratedDate: template.lastGeneratedDate,
        shouldGenerate: shouldGenerateToday(template, today),
      });

      if (shouldGenerateToday(template, today)) {
        logger.info(`✅ Generating task from template: ${template.name} (${template.recurrenceType})`);

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

        logger.info(`Adding task to dailyData/${today}:`, {
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

        logger.info(`✅ Task saved to Firebase: ${newTask.text}`);

        generatedCount++;

        // 템플릿의 lastGeneratedDate 업데이트
        templates[i].lastGeneratedDate = today;
        updatedTemplateCount++;
      }
    }

    // 템플릿 배열 업데이트 (SyncData 래퍼 사용)
    if (updatedTemplateCount > 0) {
      logger.info(`Updating ${updatedTemplateCount} templates with lastGeneratedDate: ${today}`);

      await db.ref("users/user/templates").set({
        data: templates,
        updatedAt: Date.now(),
        deviceId: "firebase-function",
      });

      logger.info("✅ Templates updated in Firebase");
    }

    logger.info(`✅ Daily template generation completed!`, {
      date: today,
      generatedCount,
      updatedTemplateCount,
      totalTemplates: templates.length,
    });

    return {
      success: true,
      date: today,
      generatedCount,
      updatedTemplateCount,
    };
  } catch (error) {
    logger.error("Error during daily template generation:", error);
    throw error;
  }
});
