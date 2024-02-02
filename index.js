const port = 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { default: Stripe } = require("stripe");
const { log } = require("console");

app.use(express.json());
app.use(cors());
// Database connection with mpongodb

mongoose.connect(
  "mongodb+srv://sruthik:sruthik@cluster0.67lluss.mongodb.net/Ecommerce"
);

// API creation
app.get("/", (req, res) => {
  res.send("Express app is running");
});


// Image storage engine
const storage = multer.diskStorage({
  destination: "./upload/images",
  filename: (req, file, cb) => {
    return cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({ storage: storage });

// Creating upload endpoints for images
app.use("/images", express.static("upload/images"));
app.post("/upload", upload.single("product"), (req, res) => {
  res.json({
    success: 1,
    image_url: `http://localhost:${port}/images/${req.file.filename}`,
  });
});


// schema for creating products
const Product = mongoose.model("product", {
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  old_price: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now(),
  },
  available: {
    type: Boolean,
    default: true,
  },
});

//Creating api for add product to mongodb
app.post("/addproduct", async (req, res) => {
  let products = await Product.find({});
  let id;
  if (products.length > 0) {
    let last_product_array = products.slice(-1);
    let last_product = last_product_array[0];
    id = last_product.id + 1;
  } else {
    id = 1;
  }
  const product = new Product({
    id: id,
    name: req.body.name,
    image: req.body.image,
    category: req.body.category,
    new_price: req.body.new_price,
    old_price: req.body.old_price,
  });
  await product.save();
  console.log("saved");
  res.json({
    success: true,
    name: req.body.name,
  });
});


// creating api for deleting products
app.post("/removeproduct", async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  console.log("Removed");
  res.json({
    success: true,
    name: req.body.name,
  });
});


// Creating api for getting all products
app.get("/allproducts", async (req, res) => {
  let products = await Product.find({});
  console.log("All products fetched");
  res.send(products);
});


// Schema creating for user model
const Users = mongoose.model("Users", {
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
  },
  cartData: {
    type: Object,
  },
  date: {
    type: Date,
    default: Date.now(),
  },
});


// Creating endpoints for registering user
app.post("/signup", async (req, res) => {
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({
      success: false,
      errors: "Existing user found with same email address",
    });
  }
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }
  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });
  await user.save();

  const data = {
    user: {
      id: user.id,
    },
  };

  const token = jwt.sign(data, "secret_ecom");
  res.json({ success: true, token });
});



// creating endpoint for user login
app.post("/login", async (req, res) => {
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    const passCompare = req.body.password === user.password;
    if (passCompare) {
      const data = {
        id: user.id,
      };
      const token = jwt.sign(data, "secret_ecom");
      res.json({ success: true, token });
    } else {
      res.json({ success: false, errors: "Wrong password" });
    }
  } else {
    res.json({ success: "false", errors: "Wrong Email id" });
  }
});



// creating endpoints for newcollection data
app.get("/newcollections", async (req, res) => {
  let products = await Product.find({});
  let newcollection = products.slice(1).slice(-8);
  console.log("NewCollection Fetched");
  res.send(newcollection);
});



// creating endpoints for popular in women section
app.get("/popularinwomen", async (req, res) => {
  let products = await Product.find({ category: "women" });
  let popular_in_women = products.slice(0, 4);

  console.log("Popular in Women Fetched");
  res.send(popular_in_women);
});




// creating middleware to fetch user
const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    res.status(401).send({ errors: "Please authenticated using valid token" });
  } else {
    try {
      const data = jwt.verify(token, "secret_ecom");
      req.user = data;
      next();
    } catch (error) {
      res.status(401).send({ errors: "Please authenticate using valid token" });
    }
  }
};



// creating endpoints for adding products to cart data
app.post("/addtocart", fetchUser, async (req, res) => {
  let userData = await Users.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await Users.findByIdAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Added");
});



// creating endpoints for remove product from cartdata
app.post("/removefromcart", fetchUser, async (req, res) => {
  let userData = await Users.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0)
    userData.cartData[req.body.itemId] -= 1;
  await Users.findByIdAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Removed");
});



// Creating endpoints to get cartdata
app.post("/getcart", fetchUser, async (req, res) => {
  console.log("Get cart");
  let userData = await Users.findOne({ _id: req.user.id });
  if(userData.cartData){
    res.json(userData.cartData);
  }
  else{
    res.send("No cart data");
  }
});


// Creating endpoints to get cartdata
app.post("/getuser", fetchUser, async (req, res) => {
  console.log("Get user");
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.name);
});

// ----------------------------SAVING ORDER DETAILS---------------------
// Schema creating for order model

const Orders = mongoose.model("Orders", {
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  productId: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
  },
  price: {
    type: Number,
  },
  totalAmount: {
    type: String,
  },
  date: {
    type: Date,
    default: Date.now(),
  },
});

app.post("/save-stripe-token", fetchUser, async (req, res) => {
  console.log("Payment details saved to stripe ");
  const token = req.body.token;
  const amount = req.body.amount;
  // Create a charge using the token and amount
  const stripe = require("stripe")(
    "sk_test_51O8FosSAXe2qclcVjGdwhxNA2Gel6iGO6UA9tCOqeCcI1fVSgfKV7jMNH8f1yG7hR2aUeG1RNxFxHZqm4PNyBOec000ZTh0oHN"
  );

  const customer = await stripe.customers.create({
    email: token.email, // Use the email from the token
    source: token.id, // Use the token ID as the payment method source
  });

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100, // Amount in cents
    currency: "inr",
    payment_method_types: ["card"],
    description: "Ecommerce product payment",
    payment_method: token.card.id, // Use the card ID from the token's card object
    customer: customer.id,
    confirm: true,
  });

  console.log("Payment status : ", paymentIntent.status);

  if (paymentIntent.status === "requires_action") {
    // Return client_secret and requires_action to the frontend

    return res.status(200).json({
      requires_action: true,
      client_secret: paymentIntent.client_secret,
      payment_method: paymentIntent.payment_method,
    });
  } else if (paymentIntent.status === "succeeded") {
    console.log("2");
    // saving to mongo db
    console.log("Payment data saved to mongodb");
    console.log("user id :", req.user.id);
    console.log("totalAmount :", amount);
    let userData = await Users.findOne({ _id: req.user.id });
    for (const key in userData.cartData) {
      if (userData.cartData.hasOwnProperty(key)) {
        const value = userData.cartData[key];

        // Check if the value is greater than 0
        if (value > 0) {
          let productdata = await Product.findOne({ id: key });
          const order = new Orders({
            userId: req.user.id,
            productId: productdata.id,
            quantity: value,
            price: productdata.new_price,
            totalAmount: productdata.new_price * value,
          });
          await order.save();
          userData.cartData[key] -= 1;
          await Users.findByIdAndUpdate(
            { _id: req.user.id },
            { cartData: userData.cartData }
          );
        }
      }
    }
    return res.status(200).json({
      message: "Success",
    });
  } else {
    // Handle other paymentIntent statuses
    console.log("3");
    return res.status(500).json({
      message: "Payment failed",
    });
  }
});

app.post("/save-mongodb", fetchUser, async (req, res) => {
  console.log("Saving to mongodb");
  let userData = await Users.findOne({ _id: req.user.id });
  for (const key in userData.cartData) {
    if (userData.cartData.hasOwnProperty(key)) {
      const value = userData.cartData[key];

      // Check if the value is greater than 0
      if (value > 0) {
        let productdata = await Product.findOne({ id: key });
        const order = new Orders({
          userId: req.user.id,
          productId: productdata.id,
          quantity: value,
          price: productdata.new_price,
          totalAmount: productdata.new_price * value,
        });
        await order.save();
        userData.cartData[key] -= 1;
          await Users.findByIdAndUpdate(
            { _id: req.user.id },
            { cartData: userData.cartData }
          );
      }
    }
  }
  return res.json(userData.cartData);
});


//Creating api for all paid order list for admin side
app.get('/orderProducts', async (req, res) => {
  let products = await Orders.find({});
  console.log("All paid products fetched");
  const modifiedList = await Promise.all(products.map(async (product) => {
    let userData = await Users.findOne({ _id: product.userId });
    let productData = await Product.findOne({ id: product.productId });
    return { ...product,price:product.price,username: userData.name ,name: productData.name,image:productData.image,category:productData.category };
  }));
  res.send(modifiedList);
})


//Creating api for Current user order list
app.get('/orderhistory',fetchUser, async (req, res) => {
  console.log(req.user.id);
  let products = await Orders.find({userId:req.user.id});
  console.log("All paid products fetched");
    const modifiedList = await Promise.all(products.map(async (product) => {
      let userData = await Users.findOne({ _id: product.userId });
      let productData = await Product.findOne({ id: product.productId });
      return { ...product,price:product.price,username: userData.name ,name: productData.name,image:productData.image,category:productData.category };
    }));
    res.send(modifiedList);
})


app.listen(port, (error) => {
  if (!error) {
    console.log("server running on port " + port);
  } else {
    console.log("Error :" + error);
  }
});
