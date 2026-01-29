const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Update user password
admin.auth().updateUser('21VuZW4cdXd9jGKOgPa5YQegICw1', {
  password: 'zxcvFDSA90%'
})
.then(() => {
  console.log('✅ Contraseña actualizada para stevenvallejo780@gmail.com');
  process.exit(0);
})
.catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
