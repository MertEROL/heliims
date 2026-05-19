import { db } from "./auth.js";
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc,
  updateDoc, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  runTransaction,
  arrayUnion, 
  arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Adds an audit log entry in the database.
 * @param {string} actionType - E.g. 'CREATE', 'UPDATE', 'MOUNT', 'UNMOUNT'
 * @param {string} details - Detailed explanation of the action.
 * @param {string} userSicil - Operator registration number.
 * @param {string} userName - Operator full name.
 * @param {string} comment - The user's custom reasoning/comment for the action.
 * @returns {Promise<void>}
 */
export async function addLog(actionType, details, userSicil, userName, comment) {
  try {
    await addDoc(collection(db, "logs"), {
      timestamp: new Date().toISOString(),
      actionType,
      details,
      userSicil,
      userName,
      comment: comment || "Açıklama girilmedi."
    });
  } catch (error) {
    console.error("Log kaydı oluşturulamadı:", error);
  }
}

/**
 * Registers a new helicopter in the inventory.
 * @param {string} tailNo - Unique tail number (Kuyruk No).
 * @param {string} model - Heli model.
 * @param {string} fleet - Location/Fleet.
 * @param {string} notes - Extra notes.
 * @param {string} userSicil - Operator sicil.
 * @param {string} userName - Operator name.
 * @returns {Promise<void>}
 */
export async function addHelicopter(tailNo, model, fleet, notes, userSicil, userName) {
  const cleanTailNo = tailNo.trim().toUpperCase();
  const heliDocRef = doc(db, "helicopters", cleanTailNo);
  
  // Check if tail number already exists
  const existingDoc = await getDoc(heliDocRef);
  if (existingDoc.exists()) {
    throw new Error(`Bu kuyruk numarası (${cleanTailNo}) ile kayıtlı bir helikopter zaten mevcut!`);
  }

  await setDoc(heliDocRef, {
    tailNo: cleanTailNo,
    model,
    fleet,
    notes: notes.trim(),
    equipmentIds: [],
    updatedAt: new Date().toISOString(),
    updatedBy: userSicil
  });

  await addLog(
    "CREATE",
    `${cleanTailNo} kuyruk numaralı yeni ${model} helikopteri ${fleet} filosuna eklendi.`,
    userSicil,
    userName,
    "İlk envanter kaydı oluşturuldu."
  );
}

/**
 * Subscribes to real-time updates for helicopters.
 * @param {function} callback - Callback function that receives list of helicopters.
 * @returns {function} Unsubscribe function.
 */
export function getHelicopters(callback) {
  const q = query(collection(db, "helicopters"), orderBy("tailNo"));
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach((doc) => {
      list.push(doc.data());
    });
    callback(list);
  }, (error) => console.error("Helikopter veri çekme hatası:", error));
}

/**
 * Registers a new piece of mission equipment.
 * @param {string} serialNo - Unique serial number.
 * @param {string} name - Equipment name/type (e.g. FLIR).
 * @param {string} model - Equipment model.
 * @param {string} status - Initial status ('faal', 'gayri_faal', 'onarimda').
 * @param {string} fleet - Initial fleet warehouse location.
 * @param {string} notes - Extra specs or notes.
 * @param {string} userSicil - Operator.
 * @param {string} userName - Operator name.
 * @returns {Promise<void>}
 */
export async function addEquipment(serialNo, name, model, status, fleet, notes, userSicil, userName) {
  const cleanSerialNo = serialNo.trim().toUpperCase();
  const equipDocRef = doc(db, "equipment", cleanSerialNo);

  const existingDoc = await getDoc(equipDocRef);
  if (existingDoc.exists()) {
    throw new Error(`Bu seri numarası (${cleanSerialNo}) ile kayıtlı bir ekipman zaten mevcut!`);
  }

  await setDoc(equipDocRef, {
    serialNo: cleanSerialNo,
    name: name.trim(),
    model: model.trim(),
    status,
    locationType: "depo", // Always starts in a warehouse
    locationId: fleet,    // Fleet name representing warehouse
    notes: notes.trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: userSicil
  });

  await addLog(
    "CREATE",
    `${cleanSerialNo} seri nolu ${name} (${model}) ekipmanı ${fleet} deposunda faal olarak kaydedildi.`,
    userSicil,
    userName,
    "İlk envanter kaydı oluşturuldu."
  );
}

/**
 * Subscribes to real-time updates for equipment.
 * @param {function} callback - Callback function that receives list of equipments.
 * @returns {function} Unsubscribe function.
 */
export function getEquipments(callback) {
  const q = query(collection(db, "equipment"), orderBy("name"));
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach((doc) => {
      list.push(doc.data());
    });
    callback(list);
  }, (error) => console.error("Ekipman veri çekme hatası:", error));
}

/**
 * Updates status and/or depot location of a piece of equipment.
 * @param {string} equipId - Equipment serial number.
 * @param {string} status - New status.
 * @param {string} fleetName - New fleet warehouse name (ignored if mounted on a helicopter).
 * @param {string} notes - Updated notes.
 * @param {string} userSicil - Operator.
 * @param {string} userName - Operator name.
 * @param {string} comment - The user's action comment.
 * @returns {Promise<void>}
 */
export async function updateEquipmentStatus(equipId, status, fleetName, notes, userSicil, userName, comment) {
  const equipRef = doc(db, "equipment", equipId);
  
  await runTransaction(db, async (transaction) => {
    const equipDoc = await transaction.get(equipRef);
    if (!equipDoc.exists()) {
      throw new Error("Ekipman bulunamadı!");
    }

    const data = equipDoc.data();
    const updateData = {
      status,
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
      updatedBy: userSicil
    };

    let logDetail = `${equipId} seri nolu ekipman durumu "${status.toUpperCase()}" olarak güncellendi.`;

    // Only update warehouse location if the equipment is currently in "depo"
    if (data.locationType === "depo") {
      updateData.locationId = fleetName;
      logDetail += ` Konum: ${fleetName} Deposu.`;
    }

    transaction.update(equipRef, updateData);
    
    // Log in the same transaction
    await addLog(
      "UPDATE",
      logDetail,
      userSicil,
      userName,
      comment
    );
  });
}

/**
 * Mounts a piece of equipment onto a helicopter.
 * Must be executed as a transaction to ensure integrity.
 * @param {string} equipId - Equipment serial number.
 * @param {string} heliId - Helicopter tail number.
 * @param {string} userSicil - Operator.
 * @param {string} userName - Operator name.
 * @param {string} comment - The operator's comment.
 * @returns {Promise<void>}
 */
export async function mountEquipmentToHelicopter(equipId, heliId, userSicil, userName, comment) {
  const equipRef = doc(db, "equipment", equipId);
  const heliRef = doc(db, "helicopters", heliId);

  await runTransaction(db, async (transaction) => {
    const equipDoc = await transaction.get(equipRef);
    const heliDoc = await transaction.get(heliRef);

    if (!equipDoc.exists()) throw new Error("Ekipman bulunamadı!");
    if (!heliDoc.exists()) throw new Error("Helikopter bulunamadı!");

    const equipData = equipDoc.data();
    const heliData = heliDoc.data();

    // Verification guards
    if (equipData.locationType === "helicopter") {
      throw new Error(`Bu ekipman zaten başka bir helikopterde (${equipData.locationId}) takılı!`);
    }
    if (equipData.status !== "faal") {
      throw new Error(`Gayri faal veya onarımda olan bir ekipman helikoptere monte edilemez!`);
    }

    // 1. Update Equipment Location
    transaction.update(equipRef, {
      locationType: "helicopter",
      locationId: heliId,
      updatedAt: new Date().toISOString(),
      updatedBy: userSicil
    });

    // 2. Update Helicopter's Equipment list
    transaction.update(heliRef, {
      equipmentIds: arrayUnion(equipId),
      updatedAt: new Date().toISOString(),
      updatedBy: userSicil
    });

    // 3. Log
    await addLog(
      "MOUNT",
      `${equipId} seri nolu ${equipData.name} ekipmanı, ${heliId} kuyruk nolu helikoptere monte edildi.`,
      userSicil,
      userName,
      comment
    );
  });
}

/**
 * Unmounts a piece of equipment from a helicopter and returns it to a fleet warehouse.
 * Must be executed as a transaction.
 * @param {string} equipId - Equipment serial number.
 * @param {string} heliId - Helicopter tail number.
 * @param {string} targetWarehouse - Fleet name representing the target warehouse.
 * @param {string} userSicil - Operator.
 * @param {string} userName - Operator name.
 * @param {string} comment - The operator's comment.
 * @returns {Promise<void>}
 */
export async function unmountEquipmentFromHelicopter(equipId, heliId, targetWarehouse, userSicil, userName, comment) {
  const equipRef = doc(db, "equipment", equipId);
  const heliRef = doc(db, "helicopters", heliId);

  await runTransaction(db, async (transaction) => {
    const equipDoc = await transaction.get(equipRef);
    const heliDoc = await transaction.get(heliRef);

    if (!equipDoc.exists()) throw new Error("Ekipman bulunamadı!");
    if (!heliDoc.exists()) throw new Error("Helikopter bulunamadı!");

    const equipData = equipDoc.data();

    // 1. Update Equipment Location to Depot
    transaction.update(equipRef, {
      locationType: "depo",
      locationId: targetWarehouse,
      updatedAt: new Date().toISOString(),
      updatedBy: userSicil
    });

    // 2. Update Helicopter to Remove Equipment
    transaction.update(heliRef, {
      equipmentIds: arrayRemove(equipId),
      updatedAt: new Date().toISOString(),
      updatedBy: userSicil
    });

    // 3. Log
    await addLog(
      "UNMOUNT",
      `${equipId} seri nolu ${equipData.name} ekipmanı, ${heliId} kuyruk nolu helikopterden söküldü ve ${targetWarehouse} deposuna aktarıldı.`,
      userSicil,
      userName,
      comment
    );
  });
}

/**
 * Subscribes to audit logs updates (real-time).
 * @param {function} callback - Callback function that receives list of logs.
 * @returns {function} Unsubscribe function.
 */
export function getLogs(callback) {
  const q = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(200));
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach((doc) => {
      list.push(doc.data());
    });
    callback(list);
  }, (error) => console.error("Log veri çekme hatası:", error));
}

/**
 * Subscribes to user profiles (admin view only).
 * @param {function} callback - Callback function.
 * @returns {function} Unsubscribe function.
 */
export function getRegisteredUsers(callback) {
  const q = query(collection(db, "users"), orderBy("sicil"));
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach((doc) => {
      list.push(doc.data());
    });
    callback(list);
  }, (error) => console.error("Kullanıcı veri çekme hatası:", error));
}
