const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const MessBill = require("./v1/modules/mess/messBillModel.js");

mongoose.connect(process.env.DB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const bills = await MessBill.find({});
    console.log(JSON.stringify(bills, null, 2));
    process.exit(0);
  })
  .catch(err => { console.error(err); process.exit(1); });
