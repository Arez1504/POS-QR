// backend/scripts/updateProductImages.js
require('dotenv').config();
const db = require('../src/config/db');

const IMAGE_MAPPING = [
  { keywords: ['coca', 'coke', 'nước ngọt'], url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['pepsi'], url: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['aquafina', 'nước suối', 'nước lọc', 'lavie'], url: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['bia', 'heineken', 'tiger', 'beer'], url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['sữa', 'milk', 'vinamilk'], url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['cà phê', 'coffee', 'cafe'], url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['trà sữa', 'milktea'], url: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['bánh mì', 'bread'], url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['mì', 'ramen', 'hảo hảo'], url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['snack', 'oishi', 'khoai tây', 'lây', 'lay'], url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['kẹo', 'candy'], url: 'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['táo', 'apple'], url: 'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['cam', 'orange'], url: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['kem', 'ice cream'], url: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['trứng', 'egg'], url: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['giấy', 'tissue', 'khăn'], url: 'https://images.unsplash.com/photo-1603555811370-13f568a86561?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['xà phòng', 'soap'], url: 'https://images.unsplash.com/photo-1607006342465-9f5e27a697ad?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['dầu gội', 'shampoo'], url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=500&auto=format&fit=crop&q=60' },
  { keywords: ['kem đánh răng', 'toothpaste'], url: 'https://images.unsplash.com/photo-1559599101-f09722fb4948?w=500&auto=format&fit=crop&q=60' },
];

const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60', // Grocery shelf
  'https://images.unsplash.com/photo-1601599561213-832382fd07ba?w=500&auto=format&fit=crop&q=60', // Shop counter
  'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&auto=format&fit=crop&q=60', // Convenience store
];

async function updateImages() {
  console.log('🔄 Đang kết nối CSDL và đọc danh sách sản phẩm...');
  try {
    const [products] = await db.query('SELECT id, name, image FROM products');
    console.log(`📋 Tìm thấy ${products.length} sản phẩm.`);

    let updatedCount = 0;

    for (const prod of products) {
      const nameLower = prod.name.toLowerCase();
      let matchedUrl = '';

      // Tìm kiếm theo từ khóa
      for (const mapping of IMAGE_MAPPING) {
        if (mapping.keywords.some(kw => nameLower.includes(kw))) {
          matchedUrl = mapping.url;
          break;
        }
      }

      // Nếu không khớp từ khóa nào, gán ảnh mặc định ngẫu nhiên trong danh sách
      if (!matchedUrl) {
        const randIdx = prod.id % DEFAULT_IMAGES.length;
        matchedUrl = DEFAULT_IMAGES[randIdx];
      }

      // Chỉ cập nhật nếu ảnh rỗng hoặc đang dùng ảnh demo placeholder dạng emoji
      if (!prod.image || prod.image.startsWith('http') === false) {
        console.log(`   ➔ Cập nhật ảnh cho: "${prod.name}"`);
        await db.execute('UPDATE products SET image = ? WHERE id = ?', [matchedUrl, prod.id]);
        updatedCount++;
      } else {
        console.log(`   ➖ Giữ nguyên ảnh hiện tại của: "${prod.name}"`);
      }
    }

    console.log(`\n✅ Hoàn thành! Đã cập nhật thành công ${updatedCount} sản phẩm.`);
  } catch (error) {
    console.error('❌ Lỗi xảy ra:', error);
  } finally {
    process.exit(0);
  }
}

updateImages();
