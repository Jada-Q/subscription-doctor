# OCR debugging for subscription-doctor

## Common PaddleOCR issues
- WASM memory exceeded: iOS Safari限制~256MB, 1600px是安全上限
- 字典空行: ppocrv5_dict.txt第1行是CTC blank token, 不能filter掉
- 空格丢失: "APPLE COM BILL"变成"APPLECOMBILL", 用normalizeForMatch处理
- 超时: 模型加载30s, 识别15s, 超时后resetOcrService()清除singleton

## Debug steps
1. 检查 public/models/ 下文件是否完整
2. 在spike页面测试单张图片（dev环境only）
3. 看Sentry的OcrTimeoutError频率
4. 检查图片尺寸是否超过1600px
