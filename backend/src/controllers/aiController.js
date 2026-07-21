// backend/src/controllers/aiController.js
const { 
  AI_PROVIDER,
  genAI, 
  AI_MODEL, 
  MAX_TOOL_CALLS, 
  SYSTEM_PROMPT,
  OLLAMA_BASE_URL,
  OLLAMA_MODEL
} = require('../config/aiConfig');
const { toolDefinitions, toolExecutors } = require('./aiTools');
const db = require('../config/db');

// ── Chuyển đổi tool definitions sang format Gemini ────────────────────────────
const geminiFunctionDeclarations = toolDefinitions.map(tool => ({
  name: tool.name,
  description: tool.description,
  parameters: tool.parameters
}));

// ── Chuyển đổi tool definitions sang format Ollama ────────────────────────────
const ollamaTools = toolDefinitions.map(tool => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }
}));

// ── POST /api/ai/chat ─────────────────────────────────────────────────────────
const chat = async (req, res) => {
  try {
    const { message, history = [], session_id } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Tin nhắn không được trống' });
    }

    let replyText = '';
    let toolsUsed = [];
    let successModel = '';

    if (AI_PROVIDER === 'ollama') {
      console.log(`Đang sử dụng Ollama chat với model: ${OLLAMA_MODEL}`);
      
      const cleanHistory = history.length > 0 && history[history.length - 1].content === message
        ? history.slice(0, -1)
        : history;

      const messages = [];
      messages.push({ role: 'system', content: SYSTEM_PROMPT });

      for (const msg of cleanHistory.slice(-20)) {
        if (msg.role === 'user') {
          messages.push({ role: 'user', content: msg.content });
        } else if (msg.role === 'assistant') {
          messages.push({ role: 'assistant', content: msg.content });
        }
      }
      
      messages.push({ role: 'user', content: message });

      let loopCount = 0;
      successModel = OLLAMA_MODEL;

      while (loopCount < MAX_TOOL_CALLS) {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: OLLAMA_MODEL,
            messages: messages,
            stream: false,
            options: {
              temperature: 0.1
            },
            tools: ollamaTools
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Lỗi kết nối Ollama API: ${response.statusText} - ${errText}`);
        }

        const resJson = await response.json();
        const assistantMsg = resJson.message;
        
        messages.push(assistantMsg);

        if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
          for (const toolCall of assistantMsg.tool_calls) {
            const name = toolCall.function.name;
            const args = toolCall.function.arguments || {};
            console.log(`[Ollama] AI gọi tool: ${name}(${JSON.stringify(args)})`);

            let result;
            try {
              if (toolExecutors[name]) {
                result = await toolExecutors[name](args);
                toolsUsed.push(name);
              } else {
                result = { error: `Tool "${name}" không tồn tại` };
              }
            } catch (toolError) {
              console.error(`[Ollama] Tool ${name} error:`, toolError.message);
              result = { error: `Lỗi khi truy vấn dữ liệu: ${toolError.message}` };
            }

            messages.push({
              role: 'tool',
              name: name,
              content: JSON.stringify(result)
            });
          }
          loopCount++;
        } else {
          replyText = assistantMsg.content || '';
          break;
        }
      }
    } else {
      if (!genAI) {
        return res.status(503).json({
          success: false,
          message: 'Tính năng AI chưa được cấu hình. Vui lòng thêm GEMINI_API_KEY vào file .env'
        });
      }

      // Build conversation history cho Gemini
      const geminiHistory = [];
      const cleanHistory = history.length > 0 && history[history.length - 1].content === message
        ? history.slice(0, -1)
        : history;

      for (const msg of cleanHistory.slice(-20)) {
        if (msg.role === 'user') {
          geminiHistory.push({ role: 'user', parts: [{ text: msg.content }] });
        } else if (msg.role === 'assistant') {
          geminiHistory.push({ role: 'model', parts: [{ text: msg.content }] });
        }
      }

      const modelsToTry = [AI_MODEL, 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
      const uniqueModels = [...new Set(modelsToTry.filter(Boolean))];
      let lastError = null;

      for (const modelName of uniqueModels) {
        try {
          console.log(`Đang thử chat bằng model AI: ${modelName}`);
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ functionDeclarations: geminiFunctionDeclarations }],
          });

          const chatSession = model.startChat({ history: geminiHistory });

          let response = await chatSession.sendMessage(message);
          toolsUsed = [];
          let loopCount = 0;

          while (loopCount < MAX_TOOL_CALLS) {
            const candidate = response.response.candidates?.[0];
            if (!candidate) break;

            const parts = candidate.content?.parts || [];
            const functionCalls = parts.filter(p => p.functionCall);

            if (functionCalls.length === 0) break;

            const functionResponses = [];
            for (const part of functionCalls) {
              const { name, args } = part.functionCall;
              console.log(`AI gọi tool: ${name}(${JSON.stringify(args)})`);

              let result;
              try {
                if (toolExecutors[name]) {
                  result = await toolExecutors[name](args || {});
                  toolsUsed.push(name);
                } else {
                  result = { error: `Tool "${name}" không tồn tại` };
                }
              } catch (toolError) {
                console.error(`Tool ${name} error:`, toolError.message);
                result = { error: `Lỗi khi truy vấn dữ liệu: ${toolError.message}` };
              }

              functionResponses.push({
                functionResponse: {
                  name,
                  response: { result: JSON.stringify(result) }
                }
              });
            }

            response = await chatSession.sendMessage(functionResponses);
            loopCount++;
          }

          replyText = response.response.text();
          successModel = modelName;
          break;
        } catch (err) {
          console.warn(`Lỗi khi chat bằng model ${modelName}:`, err.message);
          lastError = err;
          
          if (err.message?.includes('API key') || err.message?.includes('API_KEY')) {
            break;
          }
        }
      }

      if (!replyText) {
        throw lastError || new Error('Tất cả các model AI đều không hoạt động');
      }
    }

    console.log(`Chat thành công với model: ${successModel}`);

    const finalSessionId = session_id || `session_${req.user.id}_${Date.now()}`;
    try {
      await db.execute(
        `INSERT INTO ai_chat_history (session_id, user_id, role, content, tools_used)
         VALUES (?, ?, 'user', ?, NULL)`,
        [finalSessionId, req.user.id, message]
      );
      await db.execute(
        `INSERT INTO ai_chat_history (session_id, user_id, role, content, tools_used)
         VALUES (?, ?, 'assistant', ?, ?)`,
        [finalSessionId, req.user.id, replyText, toolsUsed.length > 0 ? JSON.stringify(toolsUsed) : null]
      );
    } catch (dbErr) {
      console.error('Không lưu được lịch sử chat:', dbErr.message);
    }

    res.json({
      success: true,
      reply: replyText,
      session_id: finalSessionId,
      tools_used: toolsUsed
    });

  } catch (error) {
    console.error('AI Chat error:', error);

    if (error.message?.includes('API key')) {
      return res.status(503).json({ success: false, message: 'API Key AI không hợp lệ. Kiểm tra GEMINI_API_KEY trong .env' });
    }
    if (error.message?.includes('quota') || error.message?.includes('429')) {
      return res.status(429).json({ success: false, message: 'Đã vượt giới hạn số lượng request AI. Vui lòng thử lại sau 1 phút.' });
    }
    if (error.message?.includes('fetch') || error.message?.includes('ECONNREFUSED')) {
      return res.status(503).json({ success: false, message: 'Không thể kết nối tới Ollama. Vui lòng kiểm tra xem Ollama đã được bật chưa (chạy lệnh: ollama run ' + OLLAMA_MODEL + ')' });
    }

    res.status(500).json({ success: false, message: 'Lỗi xử lý AI: ' + (error.message || 'Không xác định') });
  }
};

// ── GET /api/ai/suggestions ───────────────────────────────────────────────────
const getSuggestions = async (req, res) => {
  const suggestions = [
    { text: 'Doanh thu hôm nay thế nào?' },
    { text: 'Sản phẩm nào sắp hết hàng?' },
    { text: 'Top 5 sản phẩm bán chạy tháng này' },
    { text: 'Hiệu suất nhân viên hôm nay' },
    { text: 'Phân tích xu hướng kinh doanh' },
    { text: 'Khung giờ nào bán chạy nhất?' },
  ];
  res.json({ success: true, data: suggestions });
};

// ── GET /api/ai/history ───────────────────────────────────────────────────────
const getHistory = async (req, res) => {
  try {
    const { session_id, limit = 50 } = req.query;
    const lim = Math.min(100, parseInt(limit) || 50);

    if (session_id) {
      const [rows] = await db.query(
        `SELECT role, content, tools_used, created_at FROM ai_chat_history
         WHERE session_id = ? AND user_id = ? ORDER BY created_at ASC LIMIT ?`,
        [session_id, req.user.id, lim]
      );
      return res.json({ success: true, data: rows });
    }

    // Lấy danh sách sessions
    const [sessions] = await db.query(
      `SELECT session_id, MIN(created_at) AS started_at, MAX(created_at) AS last_msg,
              COUNT(*) AS message_count
       FROM ai_chat_history WHERE user_id = ?
       GROUP BY session_id ORDER BY last_msg DESC LIMIT 20`,
      [req.user.id]
    );
    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('AI history error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ── POST /api/ai/inventory-analysis ───────────────────────────────────────────
const analyzeInventory = async (req, res) => {
  try {

    const { limit = 10 } = req.body;
    const topN = Math.min(20, Math.max(1, parseInt(limit) || 10));

    // 1. Lấy top sản phẩm bán chạy nhất 30 ngày gần nhất + tồn kho hiện tại
    const today = new Date().toISOString().slice(0, 10);
    const d30 = new Date();
    d30.setDate(d30.getDate() - 30);
    const from30 = d30.toISOString().slice(0, 10);

    const [topProducts] = await db.query(`
      SELECT
        p.id, p.name, p.sku, p.barcode, c.name AS category_name,
        p.stock_quantity AS current_stock,
        COALESCE(p.min_stock, 5) AS min_stock,
        p.price, p.cost_price,
        COALESCE(SUM(oi.quantity), 0) AS sold_30d,
        COUNT(DISTINCT oi.order_id) AS order_count_30d
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN order_items oi ON oi.product_id = p.id
        AND oi.order_id IN (
          SELECT id FROM orders WHERE order_status != 'cancelled'
          AND DATE(created_at) BETWEEN ? AND ?
        )
      WHERE p.is_active = TRUE
      GROUP BY p.id
      ORDER BY sold_30d DESC
      LIMIT ?
    `, [from30, today, topN]);

    // 2. Lấy thêm dữ liệu 7 ngày gần nhất cho mỗi SP (tính xu hướng ngắn hạn)
    const d7 = new Date();
    d7.setDate(d7.getDate() - 7);
    const from7 = d7.toISOString().slice(0, 10);

    const productIds = topProducts.map(p => p.id);
    let sold7dMap = {};
    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      const [sold7d] = await db.query(`
        SELECT oi.product_id, COALESCE(SUM(oi.quantity), 0) AS sold_7d
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE o.order_status != 'cancelled'
          AND DATE(o.created_at) BETWEEN ? AND ?
          AND oi.product_id IN (${placeholders})
        GROUP BY oi.product_id
      `, [from7, today, ...productIds]);
      sold7d.forEach(r => { sold7dMap[r.product_id] = Number(r.sold_7d); });
    }

    // 2.5. Lấy phân bố tồn kho theo danh mục (cho Biểu đồ)
    const [categoryStockData] = await db.query(`
      SELECT COALESCE(c.name, 'Chưa phân loại') as category, SUM(p.stock_quantity) as total_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = TRUE
      GROUP BY p.category_id
    `);

    const totalStockSum = categoryStockData.reduce((sum, c) => sum + Number(c.total_stock), 0);
    const categoryDistribution = categoryStockData.map(c => ({
      category: c.category,
      total_stock: Number(c.total_stock),
      percentage: totalStockSum > 0 ? ((Number(c.total_stock) / totalStockSum) * 100).toFixed(1) + '%' : '0%'
    }));

    // 3. Xây dựng data context cho AI
    const productsData = topProducts.map(p => ({
      name: p.name,
      sku: p.sku,
      category: p.category_name || 'Chưa phân loại',
      current_stock: Number(p.current_stock),
      min_stock: Number(p.min_stock),
      price: Number(p.price),
      cost_price: Number(p.cost_price),
      sold_last_30_days: Number(p.sold_30d),
      sold_last_7_days: sold7dMap[p.id] || 0,
      daily_avg_30d: Number(p.sold_30d) > 0 ? (Number(p.sold_30d) / 30).toFixed(1) : '0',
      daily_avg_7d: sold7dMap[p.id] ? (sold7dMap[p.id] / 7).toFixed(1) : '0',
      days_until_stockout: Number(p.sold_30d) > 0
        ? Math.round(Number(p.current_stock) / (Number(p.sold_30d) / 30))
        : null,
      order_count: Number(p.order_count_30d)
    }));

    // 4. Gọi Gemini phân tích
    const inventoryPrompt = `Bạn là chuyên gia phân tích tồn kho và hoạch định nhập hàng cho hệ thống POS bán lẻ.

Dưới đây là dữ liệu ${topN} sản phẩm bán chạy nhất trong 30 ngày qua, kèm tồn kho hiện tại:

${JSON.stringify(productsData, null, 2)}

Dữ liệu phân bố tổng số lượng tồn kho theo danh mục sản phẩm (sử dụng cho Phân tích Biểu đồ):

${JSON.stringify(categoryDistribution, null, 2)}

Hãy phân tích dữ liệu trên và trả lời BẰNG TIẾNG VIỆT theo đúng các quy tắc và mẫu cấu trúc dưới đây.

YÊU CẦU ĐỘ DÀI: Báo cáo phải CỰC KỲ NGẮN GỌN, cô đọng, súc tích và đi thẳng vào số liệu chính. Không viết giải thích lan man hay mô tả lê thê. Mỗi nhận xét, phân tích sản phẩm chỉ viết tối đa 1 đến 2 câu cực kỳ ngắn. Viết tối giản nhất có thể.

LƯU Ý QUAN TRỌNG: KHÔNG sử dụng các biểu tượng emoji hoặc icon hình ảnh (như 🔴, 🟠, 🟢, ⚪, 🤖, ⚠️) trong toàn bộ phản hồi. Thay vào đó, hãy dùng chữ viết thường hoặc viết hoa trong ngoặc vuông như [Nguy hiểm], [Cảnh báo], [An toàn], [Chưa đánh giá].

---

# QUY TẮC PHÂN TÍCH

1. Phân tích từng sản phẩm:
Đối với mỗi sản phẩm, hiển thị các thông tin sau:
- Tên sản phẩm, SKU, Tồn kho hiện tại, Đã bán trong 30 ngày.
- Trung bình bán/ngày (30 ngày) và Trung bình bán/ngày (7 ngày).
- Xu hướng bán: Tăng / Giảm / Ổn định (bằng cách so sánh tốc độ bán trung bình 7 ngày với 30 ngày).
- Số ngày tồn kho dự kiến = Tồn kho hiện tại / Trung bình bán 7 ngày. (Nếu không có dữ liệu bán hoặc trung bình bán bằng 0, ghi rõ "Không đủ dữ liệu").
- Phân loại mức độ tồn kho dựa trên số ngày còn lại:
  * Dưới 7 ngày: [Nguy hiểm]
  * Từ 7 đến 14 ngày: [Cảnh báo]
  * Trên 14 ngày: [An toàn]
  * Không có dữ liệu bán: [Chưa đánh giá]
- Đề xuất nhập hàng:
  * Chỉ đề xuất nếu số ngày tồn kho còn lại dưới 14 ngày.
  * Số lượng đề xuất nhập = max(Nhu cầu dự báo trong 21 ngày - Tồn kho hiện tại, 0). Trong đó: Nhu cầu dự báo = Trung bình bán 7 ngày * 21.
  * Nếu xu hướng bán tăng mạnh (trung bình 7 ngày cao hơn trung bình 30 ngày trên 20%): Tăng lượng nhập thêm 10% đến 20%.
  * Nếu xu hướng bán giảm mạnh (trung bình 7 ngày thấp hơn trung bình 30 ngày trên 20%): Giảm lượng nhập khoảng 10%.
  * Phải giải thích ngắn gọn lý do đề xuất (ví dụ: do xu hướng bán tăng/giảm, cần dự trữ bao nhiêu ngày).

---

# MẪU BÁO CÁO BẮT BUỘC KHÔNG ĐƯỢC THAY ĐỔI CẤU TRÚC TIÊU ĐỀ:

# BÁO CÁO PHÂN TÍCH TỒN KHO & HOẠCH ĐỊNH NHẬP HÀNG

## 1. Phân tích chi tiết từng sản phẩm
*(Trình bày danh sách từng sản phẩm với đầy đủ các mục phân tích nêu ở phần Quy tắc phân tích)*

## 2. Tổng hợp kết quả nhóm sản phẩm

### 2.1. Danh sách sản phẩm cần nhập ngay
*(Trình bày dưới dạng BẢNG đối với các sản phẩm dưới 7 ngày tồn kho, sắp xếp theo số ngày còn lại tăng dần. Bảng gồm các cột: Tên sản phẩm, SKU, Số ngày còn lại, Số lượng cần nhập đề xuất, Mức độ ưu tiên (Cao/Trung bình)). Nếu không có sản phẩm nào, ghi rõ "Không có sản phẩm".*

### 2.2. Danh sách sản phẩm cần theo dõi
*(Trình bày dưới dạng BẢNG đối với các sản phẩm còn từ 7 - 14 ngày tồn kho. Bảng gồm các cột: Tên sản phẩm, SKU, Số ngày còn lại, Thời điểm dự kiến cần nhập hàng. Nếu không có sản phẩm nào, ghi rõ "Không có sản phẩm".*

### 2.3. Danh sách sản phẩm an toàn
*(Trình bày dưới dạng BẢNG đối với các sản phẩm còn trên 14 ngày tồn kho. Không đề xuất nhập thêm cho nhóm này. Bảng gồm các cột: Tên sản phẩm, SKU, Số ngày còn lại. Nếu không có sản phẩm nào, ghi rõ "Không có sản phẩm".*

## 3. Phát hiện bất thường trong kho
- [Liệt kê các trường hợp bán tăng đột biến, bán giảm mạnh, không phát sinh bán nhưng tồn kho lớn, tồn kho quá cao so với nhu cầu, hoặc dữ liệu bất thường/thiếu hụt dữ liệu kèm giải thích ngắn gọn. Nếu không phát hiện bất thường, ghi "Không có bất thường"].

## 4. Phân tích Biểu đồ Phân bố tồn kho theo danh mục
*(Phân tích tỷ lệ phân bố tồn kho theo danh mục dựa trên dữ liệu biểu đồ phân bố tồn kho được cung cấp ở trên. Chỉ ra danh mục chiếm tỷ trọng cao nhất/thấp nhất và đánh giá tính cân đối của kho hàng để tránh đọng vốn).*

## 5. Đánh giá tổng quan kho & Khuyến nghị quản trị
- Đánh giá mức độ an toàn của toàn bộ kho hiện tại.
- Số lượng sản phẩm ở mức nguy hiểm và số lượng cần nhập thêm.
- Số lượng sản phẩm tồn kho dư thừa.
- So sánh xu hướng bán ngắn hạn (7 ngày) so với dài hạn (30 ngày).
- Nguy cơ thiếu hàng trong 7 ngày tới.
- Khuyến nghị tối ưu hóa dòng tiền và thứ tự ưu tiên nhập hàng (sản phẩm nào nhập trước, lý do tại sao).

---
QUY TẮC TRÌNH BÀY PHỤ:
- Số tiền định dạng: 1.234.567đ (dấu chấm phân cách, hậu tố đ).
- Tuyệt đối không tự suy diễn thông tin khi thiếu dữ liệu bán, phải ghi rõ "Không đủ dữ liệu".
- Không sử dụng bất kỳ biểu tượng hình ảnh hay emoji nào trong toàn bộ phản hồi.`;

    let analysisText = '';
    let successModel = '';

    if (AI_PROVIDER === 'ollama') {
      console.log(`Đang sử dụng Ollama phân tích tồn kho với model: ${OLLAMA_MODEL}`);
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: inventoryPrompt,
          system: 'Bạn là chuyên gia phân tích tồn kho và hoạch định nhập hàng cho hệ thống POS bán lẻ.',
          stream: false,
          options: {
            temperature: 0.2
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Lỗi kết nối Ollama API: ${response.statusText} - ${errText}`);
      }

      const resJson = await response.json();
      analysisText = resJson.response || '';
      successModel = OLLAMA_MODEL;
    } else {
      if (!genAI) {
        return res.status(503).json({
          success: false,
          message: 'Tính năng AI chưa được cấu hình. Vui lòng thêm GEMINI_API_KEY vào file .env'
        });
      }

      // Thử danh sách các model để chống lỗi 503 hoặc model không khả dụng
      const modelsToTry = [AI_MODEL, 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
      const uniqueModels = [...new Set(modelsToTry.filter(Boolean))];
      let lastError = null;

      for (const modelName of uniqueModels) {
        try {
          console.log(`Đang thử phân tích tồn kho bằng model AI: ${modelName}`);
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(inventoryPrompt);
          analysisText = result.response.text();
          successModel = modelName;
          break; // Thành công thì thoát loop
        } catch (err) {
          console.warn(`Lỗi khi phân tích bằng model ${modelName}:`, err.message);
          lastError = err;
          
          // Nếu là lỗi API key không hợp lệ thì không cần thử model khác
          if (err.message?.includes('API key') || err.message?.includes('API_KEY')) {
            break;
          }
        }
      }

      if (!analysisText) {
        throw lastError || new Error('Tất cả các model AI đều không hoạt động');
      }
    }

    console.log(`Phân tích tồn kho thành công với model: ${successModel}`);

    // 5. Lưu vào history
    const sessionId = `inventory_${req.user.id}_${Date.now()}`;
    try {
      await db.execute(
        `INSERT INTO ai_chat_history (session_id, user_id, role, content, tools_used)
         VALUES (?, ?, 'user', ?, NULL)`,
        [sessionId, req.user.id, `[Phân tích tồn kho] Top ${topN} sản phẩm bán chạy`]
      );
      await db.execute(
        `INSERT INTO ai_chat_history (session_id, user_id, role, content, tools_used)
         VALUES (?, ?, 'assistant', ?, ?)`,
        [sessionId, req.user.id, analysisText, JSON.stringify(['inventory_analysis'])]
      );
    } catch (dbErr) {
      console.error('Không lưu được lịch sử:', dbErr.message);
    }

    res.json({
      success: true,
      analysis: analysisText,
      data: productsData,
      session_id: sessionId
    });

  } catch (error) {
    console.error('AI Inventory Analysis error:', error);
    if (error.message?.includes('API key')) {
      return res.status(503).json({ success: false, message: 'API Key AI không hợp lệ' });
    }
    if (error.message?.includes('quota') || error.message?.includes('429')) {
      return res.status(429).json({ success: false, message: 'Đã vượt giới hạn AI. Thử lại sau 1 phút.' });
    }
    if (error.message?.includes('fetch') || error.message?.includes('ECONNREFUSED')) {
      return res.status(503).json({ success: false, message: 'Không thể kết nối tới Ollama. Vui lòng kiểm tra xem Ollama đã được bật chưa (chạy lệnh: ollama run ' + OLLAMA_MODEL + ')' });
    }
    res.status(500).json({ success: false, message: 'Lỗi phân tích AI: ' + (error.message || 'Không xác định') });
  }
};

module.exports = { chat, getSuggestions, getHistory, analyzeInventory };
