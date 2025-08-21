import mongoose from "mongoose";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

const conectMongoDb_server = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
};

conectMongoDb_server();

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  userDatas: {
    cartList: { type: Array, default: {} },
    yourOrders: { type: Array, default: {} },
  },
});

const User = mongoose.model("User", userSchema);

const productSchema = new mongoose.Schema({
  title: String,
  price: Number,
  description: String,
  category: String,
  image: String,
  inStock: Number,
  inCart: {
    type: Boolean,
    default: false,
  },
  rating: Number,
  quantity: {
    type: Number,
    default: 0,
  },
});

const Product = mongoose.model("Product", productSchema);

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const userexist = await User.findOne({ email });
  if (userexist) {
    return res.status(409).json({ message: "User already exists" });
  }
  const user = new User({ name, email, password });
  await user.save();
  res.status(201).json(user);
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = password === user.password;
    if (!isMatch) {
      return res.status(401).json({ message: "Wrong password!" });
    }

    const token = jwt.sign(
      {
        email: user.email,
        username: user.name,
        role: user.role,
        _id: user._id,
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Login successful",
      _id: user._id,
      token,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get("/user/:_id", async (req, res) => {
  try {
    const { _id } = req.params;
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ user });
  } catch {
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/addCartItemInUserDetails/:_id", async (req, res) => {
  const { _id } = req.params;
  const cartItem = req.body;

  if (!cartItem || typeof cartItem !== "object" || Array.isArray(cartItem)) {
    return res
      .status(400)
      .json({ message: "Provide a valid cart item object" });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      _id,
      {
        $push: { "userDatas.cartList": cartItem },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Cart item added successfully",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.put("/updateQuantityInCart/:userId/:_id/:quantity", async (req, res) => {
  const { userId, _id, quantity } = req.params;

  try {
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, "userDatas.cartList._id": _id },
      { $set: { "userDatas.cartList.$.quantity": quantity } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User or cart item not found" });
    }

    res.status(200).json({
      message: "Cart item quantity updated successfully",
      cartList: updatedUser.userDatas.cartList,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.delete("/removeCartItem/:userId/cart/:_id", async (req, res) => {
  const { userId, _id } = req.params;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $pull: {
          "userDatas.cartList": { _id: _id },
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Cart item removed successfully",
      cartList: updatedUser.userDatas.cartList,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get("/userorders/:_id", async (req, res) => {
  try {
    const { _id } = req.params;

    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ yourOrders: user.userDatas.yourOrders });
    console.log("Fetched orders for user:", _id);
  } catch (error) {
    console.error("Error fetching user orders:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.put("/yourOrders/:_id", async (req, res) => {
  const { _id } = req.params;
  const orderItems = req.body;
  if (
    !orderItems ||
    typeof orderItems !== "object" ||
    Array.isArray(orderItems)
  ) {
    return res.status(400).json({
      message: "provide valid data",
    });
  }
  try {
    const ordersUser = await User.findByIdAndUpdate(
      _id,
      {
        $push: { "userDatas.yourOrders": orderItems },
      },
      { new: true }
    );
    if (!ordersUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "ordered item added successfully",
      user: ordersUser,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.delete("/EmptyUserCart/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: { "userDatas.cartList": [] } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "All cart items removed successfully",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// const Authorization = (req, res, next) => {
//   const authHeader = req.headers.authorization;
//   console.log("Authorization header:", authHeader);

//   if (!authHeader) {
//     return res.status(401).json({ error_msg: "Token not provided" });
//   }

//   const token = authHeader.split(" ")[1];
//   if (!token) {
//     return res.status(401).json({ error_msg: "Token not valid" });
//   }

//   jwt.verify(token, process.env.JWT_SECRET_KEY, (err, payload) => {
//     if (err) {
//       console.error("JWT verify error:", err.message);
//       return res.status(403).json({ error_msg: "Invalid or expired token" });
//     }
//     req.user = payload;
//     next();
//   });
// };

app.post("/addproduct", async (req, res) => {
  const {
    title,
    price,
    inCart,
    description,
    category,
    image,
    inStock,
    rating,
  } = req.body;

  if (
    !title ||
    !price ||
    !description ||
    !category ||
    !image ||
    !inStock ||
    !rating
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const isAlreadyIn = await Product.findOne({
    title,
    image,
    inStock,
    category,
    price,
    description,
    rating,
  });

  if (isAlreadyIn) {
    return res.status(409).json({ message: "Product already exists" });
  }

  const product = new Product({
    title,
    price,
    description,
    category,
    image,
    inStock,
    inCart,
    rating,
  });

  await product.save();
  res.status(201).json({ message: "Product added successfully", product });
});

app.post("/addmanyproduct", async (req, res) => {
  const products = req.body;

  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ message: "Invalid product data" });
  }

  try {
    const createdProducts = await Product.insertMany(products);
    res.status(201).json({
      message: "Products added successfully",
      products: createdProducts,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.put("/updateproduct/:id", async (req, res) => {
  const { id } = req.params;

  const updates = {};
  if (req.body.title !== undefined) updates.title = req.body.title;
  if (req.body.price !== undefined) updates.price = req.body.price;
  if (req.body.inCart !== undefined) updates.inCart = req.body.inCart;
  if (req.body.description !== undefined)
    updates.description = req.body.description;
  if (req.body.category !== undefined) updates.category = req.body.category;
  if (req.body.image !== undefined) updates.image = req.body.image;
  if (req.body.inStock !== undefined) updates.inStock = req.body.inStock;
  if (req.body.rating !== undefined) updates.rating = req.body.rating;

  if (updates.length === 0) {
    return res
      .status(400)
      .json({ message: "Provide at least one field to update" });
  }

  try {
    const product = await Product.findByIdAndUpdate(id, updates, { new: true });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ message: "Product updated successfully", product });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.delete("/deleteproduct/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.delete("/deleteManyProducts", async (req, res) => {
  try {
    const result = await Product.deleteMany({});
    res.status(200).json({ message: "Products deleted successfully", result });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get("/products/", async (req, res) => {
  try {
    const product = await Product.find();
    if (!product || product.length === 0) {
      return res
        .status(404)
        .json({ message: "Products not found no products in the DB" });
    }
    res.status(200).json({ product });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get("/products/:_id", async (req, res) => {
  try {
    const product = await Product.findById(req.params._id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(200).json({ product });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

