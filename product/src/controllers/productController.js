const Product = require("../models/product");
const messageBroker = require("../utils/messageBroker");
const uuid = require('uuid');
const ProductService = require("../services/productsService");
/**
 * Class to hold the API implementation for the product services
 */
class ProductController {

  constructor() {
    this.createOrder = this.createOrder.bind(this);
    this.getOrderStatus = this.getOrderStatus.bind(this);
    this.ordersMap = new Map();
    this.productService = new ProductService();
  }

  async createProduct(req, res, next) {
    try {
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const product = new Product(req.body);

      const validationError = product.validateSync();
      if (validationError) {
        return res.status(400).json({ message: validationError.message });
      }

      await product.save({ timeout: 30000 });

      res.status(201).json(product);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }

  async createOrder(req, res, next) {
    try {
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      //case study 1:
      const { listproduct } = req.body;

      const idss = listproduct.map(row => {
        return row.id
      });

      const products = await Product.find({ _id: { $in: idss } }).lean();

      const newProducts = products.map((row,index) => {
        return {
          ...row,
          quantity: listproduct[index].quantity
        }
      })
      // case study 2: kiem tra neu ng dung mua 5 san pham lien tuc thi k cho mua
      if (listproduct.length >= 5) {
        return res.status(400).json({ message: "Cannot order more than 5 different products at once" });
      }
      //case study 1: kiem tra so luong san pham trong kho truoc khi tao don hang
      const result = await this.productService.checkStockProduct(listproduct);
      if(!result) {
        return  res.status(400).json({ message: "Not enough stock" });
      }

      const orderId = uuid.v4(); // Generate a unique order ID
      this.ordersMap.set(orderId, { 
        status: "pending", 
        products: newProducts, 
        username: req.user.username
      });
  
      await messageBroker.publishMessage("orders", {
        products: newProducts,
        username: req.user.username,
        orderId, // include the order ID in the message to orders queue
        createdDate: new Date()
      });

      messageBroker.consumeMessage("products", (data) => {
        const orderData = JSON.parse(JSON.stringify(data));
        const { orderId, status } = orderData;
        const order = this.ordersMap.get(orderId);
        if (status === 'failed') {
          this.ordersMap.set(orderId, { ...order, ...orderData, status: 'failed' });
          console.log("Updated order:", order);
        }
        if (order && status === 'completed') {
          // update the order in the map
          this.ordersMap.set(orderId, { ...order, ...orderData, status: 'completed' });
          console.log("Updated order:", order);
        }
      });
  
      // Long polling until order is completed
      let order = this.ordersMap.get(orderId);
      while (order.status !== 'completed' && order.status !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 1000)); // wait for 1 second before checking status again
        order = this.ordersMap.get(orderId);
      }
      if(order.status === 'failed') {
        return res.status(500).json({ message:"Orders over 24 hours have not been processed. Order failed" });
      }
      this.productService.updateQuantity(listproduct)
      // Once the order is marked as completed, return the complete order details
      return res.status(201).json(order);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
  

  async getOrderStatus(req, res, next) {
    const { orderId } = req.params;
    const order = this.ordersMap.get(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    return res.status(200).json(order);
  }

  async getProducts(req, res, next) {
    try {
      const token = req.headers.authorization;
      if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const products = await Product.find({});

      res.status(200).json(products);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
}

module.exports = ProductController;
