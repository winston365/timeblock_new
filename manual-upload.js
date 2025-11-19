// Ï≤?Î≤àÏß∏ Ïª¥Ìì®?∞Ïùò Console?êÏÑú ?§Ìñâ???òÎèô ?ÖÎ°ú???§ÌÅ¨Î¶ΩÌä∏

async function uploadMissingDataToFirebase() {
  console.log('?îÑ Starting manual upload...');

  const { db } = await import('./src/data/db/dexieClient');
  const { syncToFirebase } = await import('./src/shared/services/sync/firebase/syncCore');
  const {
    shopItemsStrategy,
    energyLevelsStrategy,
    templateStrategy,
  } = await import('./src/shared/services/sync/firebase/strategies');
  const { isFirebaseInitialized } = await import('./src/shared/services/sync/firebaseService');

  if (!isFirebaseInitialized()) {
    console.error('??Firebase not initialized!');
    return;
  }

  try {
    // 1. ShopItems ?ÖÎ°ú??
    const shopItems = await db.shopItems.toArray();
    if (shopItems.length > 0) {
      console.log(`?ì§ Uploading ${shopItems.length} shop items...`);
      await syncToFirebase(shopItemsStrategy, shopItems, 'all');
      console.log('??Shop items uploaded');
    } else {
      console.log('?†Ô∏è No shop items to upload');
    }

    // 2. Templates ?ÖÎ°ú??
    const templates = await db.templates.toArray();
    if (templates.length > 0) {
      console.log(`?ì§ Uploading ${templates.length} templates...`);
      await syncToFirebase(templateStrategy, templates);
      console.log('??Templates uploaded');
    } else {
      console.log('?†Ô∏è No templates to upload');
    }

    // 3. EnergyLevels ?ÖÎ°ú??(Î™®Îì† ?†Ïßú)
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
      console.log(`?ì§ Uploading energy levels for ${dates.length} days...`);
      for (const date of dates) {
        await syncToFirebase(energyLevelsStrategy, energyByDate[date], date);
      }
      console.log('??Energy levels uploaded');
    } else {
      console.log('?†Ô∏è No energy levels to upload');
    }

    // 4. WaifuState ?ÖÎ°ú??
    const waifuState = await db.waifuState.get('current');
    if (waifuState) {
      const { key, ...waifuData } = waifuState;
      console.log('?ì§ Uploading waifu state...');
      const { waifuStateStrategy } = await import('./src/shared/services/sync/firebase/strategies');
      await syncToFirebase(waifuStateStrategy, waifuData);
      console.log('??Waifu state uploaded');
    } else {
      console.log('?†Ô∏è No waifu state to upload');
    }

    console.log('??Manual upload completed!');
    console.log('?ëâ Now run window.debugFirebase() to verify');

  } catch (error) {
    console.error('??Upload failed:', error);
  }
}

// ?§Ìñâ
uploadMissingDataToFirebase();
