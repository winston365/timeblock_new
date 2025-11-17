/**
 * Firebase Cloud Functions for Timeblock App
 *
 * @role 매일 자동으로 템플릿에서 작업 생성
 */

const {onSchedule} = require("firebase-functions/v2/scheduler");
const {logger} = require("firebase-functions");
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
  const {randomUUID} = require("crypto");
  return `${prefix}-${randomUUID()}`;
}

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

  return {
    id: generateId("task"),
    text: template.text,
    memo: template.memo || "",
    baseDuration: template.baseDuration,
    resistance: template.resistance,
    adjustedDuration,
    timeBlock: template.timeBlock || null,
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
  const {recurrenceType, autoGenerate, lastGeneratedDate} = template;

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
  logger.info("Daily template generation started", {time: new Date().toISOString()});

  const db = admin.database();
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  try {
    // 모든 사용자 가져오기
    const usersSnapshot = await db.ref("users/user").once("value");
    const userData = usersSnapshot.val();

    if (!userData) {
      logger.info("No users found");
      return null;
    }

    // 단일 사용자 구조 (현재 앱은 users/user 경로 사용)
    let generatedCount = 0;
    let updatedTemplateCount = 0;

    // 템플릿 가져오기
    const templatesSnapshot = await db.ref("users/user/templates/all").once("value");
    const templatesData = templatesSnapshot.val();

    // SyncData 구조에서 실제 데이터 추출
    const templates = templatesData?.data;

    if (!templates || !Array.isArray(templates)) {
      logger.info("No templates found or invalid format");
      return null;
    }

    logger.info(`Found ${templates.length} templates`);

    // 각 템플릿 확인
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];

      if (shouldGenerateToday(template, today)) {
        logger.info(`Generating task from template: ${template.name}`);

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
              "5-8": {isLocked: false, isPerfect: false, isFailed: false},
              "8-11": {isLocked: false, isPerfect: false, isFailed: false},
              "11-14": {isLocked: false, isPerfect: false, isFailed: false},
              "14-17": {isLocked: false, isPerfect: false, isFailed: false},
              "17-19": {isLocked: false, isPerfect: false, isFailed: false},
              "19-24": {isLocked: false, isPerfect: false, isFailed: false},
            },
            updatedAt: Date.now(),
          };
        }

        // Task 추가
        dailyData.tasks = dailyData.tasks || [];
        dailyData.tasks.push(newTask);
        dailyData.updatedAt = Date.now();

        // Firebase에 저장 (SyncData 래퍼 사용)
        await db.ref(`users/user/dailyData/${today}`).set({
          data: dailyData,
          updatedAt: Date.now(),
          deviceId: "firebase-function",
        });

        generatedCount++;

        // 템플릿의 lastGeneratedDate 업데이트
        templates[i].lastGeneratedDate = today;
        updatedTemplateCount++;
      }
    }

    // 템플릿 배열 업데이트 (SyncData 래퍼 사용)
    if (updatedTemplateCount > 0) {
      await db.ref("users/user/templates/all").set({
        data: templates,
        updatedAt: Date.now(),
        deviceId: "firebase-function",
      });
    }

    logger.info(`Daily template generation completed. Generated ${generatedCount} tasks from ${updatedTemplateCount} templates`);

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
