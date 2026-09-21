const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/onetake', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Drop stale bad indexes that cause duplicate key errors
    const dropIndex = async (collection, index) => {
      try {
        await conn.connection.collection(collection).dropIndex(index);
        console.log(`✅ Dropped old ${index} index from ${collection}`);
      } catch (e) { /* Index doesn't exist — fine */ }
    };

    await dropIndex('equipment', 'serial_1');
    await dropIndex('payments',  'invoiceNumber_1');
    await dropIndex('payments',  'paymentNumber_1'); // also drop if unique was set

  } catch (err) {
    console.error(`❌ MongoDB Error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
