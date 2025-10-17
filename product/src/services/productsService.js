const ProductsRepository = require("../repositories/productsRepository");
const Product = require("../models/product");

/**
 * Class that ties together the business logic and the data access layer
 */
class ProductsService {
  constructor() {
    this.productsRepository = new ProductsRepository();
  }

  async createProduct(product) {
    const createdProduct = await this.productsRepository.create(product);
    return createdProduct;
  }

  async getProductById(productId) {
    const product = await this.productsRepository.findById(productId);
    return product;
  }

  async getProducts() {
    const products = await this.productsRepository.findAll();
    return products;
  }
  //case study 1: kiem tra so luong san pham trong kho truoc khi tao don hang neu so luong khong du thi tra ve false 
  async checkStockProduct(listProduct) {
    for (const tmp of listProduct) {
      const productDB = await this.productsRepository.findById(tmp.id);
      if (!productDB) {
        return false;
      }
      if (productDB.quantity < tmp.quantity) {
        return false;
      }
    }
    return true;
  }
  async updateQuantity(listProduct) {
    try {
      for (const tmp of listProduct) {
        const productDB = await this.productsRepository.findById(tmp.id);
        await Product.updateOne({ _id: tmp.id }, { quantity: productDB.quantity - tmp.quantity });
      }
      return true;
    } catch (error) {
      console.error("Error updating product quantities:", error);
      return false;
    }
  }
}

module.exports = ProductsService;
