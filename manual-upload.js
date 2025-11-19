// 첫 번째 컴퓨터의 Console에서 실행할 수동 업로드 스크립트

async function uploadMissingDataToFirebase() {
  console.log('🔄 Starting manual upload...');

  const { db } = await import('./src/data/db/dexieClient');
  const { syncToFirebase } = await import('./src/shared/services/sync/firebase/syncCore');
  const {
    shopItemsStrategy,
    energyLevelsStrategy,
    templateStrategy,
  } = await import('./src/shared/services/sync/firebase/strategies');
  const { isFirebaseInitialized } = await import('./src/shared/services/sync/firebaseService');

  if (!isFirebaseInitialized()) {
    console.error('❌ Firebase not initialized!');
    return;
  }

  try {
    // 1. ShopItems 업로드
    const shopItems = await db.shopItems.toArray();
    if (shopItems.length > 0) {
      console.log(`📤 Uploading ${shopItems.length} shop items...`);
      await syncToFirebase(shopItemsStrategy, shopItems, 'all');
      console.log('✅ Shop items uploaded');
    } else {
      console.log('⚠️ No shop items to upload');
    }

    // 2. Templates 업로드
    const templates = await db.templates.toArray();
    if (templates.length > 0) {
      console.log(`📤 Uploading ${templates.length} templates...`);
      await syncToFirebase(templateStrategy, templates, 'all');
      console.log('✅ Templates uploaded');
    } else {
      console.log('⚠️ No templates to upload');
    }

    // 3. EnergyLevels 업로드 (모든 날짜)
    const allEnergyLevels = await db.energyLevels.toArray();
    const energyByDate = {};

    allEnergyLevels.forEach(level => {
      if (!energyByDate[level.date]) {
        energyByDate[level.date] = [];
      }
      energyByDate[level.date].push(level);
    });

    const dates = Object.keys(energyByDate);
    if (dates.length > 0) {
      console.log(`📤 Uploading energy levels for ${dates.length} days...`);
      for (const date of dates) {
        await syncToFirebase(energyLevelsStrategy, energyByDate[date], date);
      }
      console.log('✅ Energy levels uploaded');
    } else {
      console.log('⚠️ No energy levels to upload');
    }

    // 4. WaifuState 업로드
    const waifuState = await db.waifuState.get('current');
    if (waifuState) {
      const { key, ...waifuData } = waifuState;
      console.log('📤 Uploading waifu state...');
      const { waifuStateStrategy } = await import('./src/shared/services/sync/firebase/strategies');
      await syncToFirebase(waifuStateStrategy, waifuData);
      console.log('✅ Waifu state uploaded');
    } else {
      console.log('⚠️ No waifu state to upload');
    }

    console.log('✅ Manual upload completed!');
    console.log('👉 Now run window.debugFirebase() to verify');

  } catch (error) {
    console.error('❌ Upload failed:', error);
  }
}

// 실행
uploadMissingDataToFirebase();
