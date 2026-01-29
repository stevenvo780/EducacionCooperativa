const admin = require('firebase-admin');
const crypto = require('crypto');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// User data
const userData = {
  uid: '21VuZW4cdXd9jGKOgPa5YQegICw1',
  email: 'stevenvallejo780@gmail.com',
  displayName: 'Steven Vallejo',
  passwordHash: hashPassword('zxcvFDSA90%'),
  createdAt: admin.firestore.FieldValue.serverTimestamp()
};

async function syncUser() {
  const userRef = db.collection('users').doc(userData.uid);
  
  // Check if user exists
  const doc = await userRef.get();
  
  if (doc.exists) {
    // Update existing user
    await userRef.update({
      passwordHash: userData.passwordHash
    });
    console.log('✅ Usuario actualizado en Firestore');
    console.log('   Email:', userData.email);
    console.log('   UID:', userData.uid);
  } else {
    // Create new user
    await userRef.set(userData);
    console.log('✅ Usuario creado en Firestore');
    console.log('   Email:', userData.email);
    console.log('   UID:', userData.uid);
  }
  
  process.exit(0);
}

syncUser().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
