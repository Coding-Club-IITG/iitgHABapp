import mongoose from "mongoose";

import MessBill from "../modules/mess/messBillModel.js";

import { mongodbUri } from "../config/default.js";

mongoose
  .connect(mongodbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    const bills = await MessBill.find({});
    console.log(JSON.stringify(bills, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
