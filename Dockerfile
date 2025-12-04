# 使用 Node.js LTS 映像檔作為基礎
FROM node:20-alpine

# 設定工作目錄
WORKDIR /app

# 安裝 Vue CLI (這是初始化 Vue 專案的工具)
RUN npm install -g @vue/cli

# 容器啟動時的指令，但我們會在外部執行 Vue CLI
CMD ["/bin/sh"]
