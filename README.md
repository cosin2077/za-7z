# za-7z

一个快速、安全、易用的 7z 命令行压缩工具，支持加密压缩和批量处理。

## 🚀 特性

- **🔐 安全加密**: 支持密码保护的压缩文件
- **💾 密码管理**: 安全存储密码到 `~/.config/za-7z/`，使用 AES-256-CBC 加密
- **⚡ 批量处理**: 支持通配符模式批量压缩/解压
- **🗑️ 智能删除**: 可选择压缩/解压后删除源文件
- **🎯 智能过滤**: 压缩时自动跳过已存在的 zip 文件
- **📱 友好交互**: 清晰的提示信息和确认操作
- **🔍 调试模式**: 支持详细的调试信息输出

## 📦 安装

```bash
npm install -g za-7z
```

**系统要求**: 需要安装 7z 命令行工具
- Ubuntu/Debian: `sudo apt install p7zip-full`
- CentOS/RHEL: `sudo yum install p7zip`
- macOS: `brew install p7zip`

## 🛠️ 使用方法

### 压缩 (za 命令)

```bash
# 压缩单个文件
za file.txt

# 压缩整个目录
za mydir

# 批量压缩目录内所有文件
za mydir/*

# 指定密码压缩
za file.txt -p mypassword

# 压缩后删除源文件
za file.txt --del

# 自动确认所有操作
za mydir/* -y

# 调试模式
za file.txt --debug
```

### 解压 (zx 命令)

```bash
# 解压单个文件
zx file.txt.zip

# 批量解压目录内所有 zip 文件
zx mydir/*.zip

# 指定密码解压
zx file.zip -p mypassword

# 解压后删除 zip 文件
zx file.zip --del

# 自动确认所有操作
zx mydir/*.zip -y
```

## 🔐 密码管理

### 密码存储
首次使用时，工具会提示输入密码：
```
Please enter password for encryption: [输入密码]
Do you want to save this password securely for future use? (y/n): y
Password saved securely to /home/user/.config/za-7z
```

### 密码管理命令
```bash
# 查看密码存储信息
za --password-info
zx --password-info

# 清除保存的密码
za --clear-password
zx --clear-password
```

### 密码安全特性
- 🔒 使用 AES-256-CBC 加密存储
- 🖥️ 与机器硬件信息绑定
- 📁 存储在用户配置目录 `~/.config/za-7z/`
- 🚫 跨机器无法解密（安全特性）

## 📋 命令参数

### 通用参数
| 参数 | 简写 | 描述 |
|------|------|------|
| `--password <pwd>` | `-p` | 指定加密密码 |
| `--del, --sdel` | | 操作成功后删除源文件 |
| `--yes` | `-y` | 自动确认所有操作 |
| `--debug` | `-d` | 显示详细调试信息 |
| `--version` | `-v` | 显示版本信息 |

### 密码管理参数
| 参数 | 描述 |
|------|------|
| `--password-info` | 显示密码存储信息 |
| `--clear-password` | 清除保存的密码 |

## 💡 使用示例

### 场景 1: 备份重要文件
```bash
# 压缩重要文档并加密
za documents/ -p my_secure_password

# 解压到新位置
zx documents.zip -p my_secure_password
```

### 场景 2: 批量处理图片文件
```bash
# 批量压缩所有图片，压缩后删除原文件
za photos/*.jpg --del -y

# 批量解压所有压缩包
zx photos/*.zip -y
```

### 场景 3: 自动化脚本
```bash
# 在脚本中使用，跳过所有确认
za backup_data/* -p $BACKUP_PASSWORD -y --del
```

## 🔧 高级功能

### 智能文件过滤
压缩时自动跳过已存在的 zip 文件：
```bash
za mydir/*
# 输出: Skipping 3 zip file(s):
#   1. /path/file1.zip (already compressed)
#   2. /path/file2.zip (already compressed)
```

### 删除警告
使用 `--del` 参数时会显示警告：
```bash
za file.txt --del
# 输出: ⚠️  WARNING: Source files will be deleted after successful compression!
#       Files that will be deleted:
#         1. /path/file.txt
```

### 密码提示优化
使用保存的密码时：
```bash
za file.txt
# 输出: Using saved password.
```

## 🏗️ 开发

### 项目结构
```
za-7z/
├── bin/
│   ├── index.js    # za/zz 命令入口
│   └── zx.js       # zx 命令入口
├── lib/
│   ├── index.js    # 压缩功能实现
│   ├── zx.js       # 解压功能实现
│   └── utils.js    # 公共工具函数
└── package.json
```

### 本地开发
```bash
git clone https://github.com/cosin2077/za-7z.git
cd za-7z
npm install
npm link

# 测试命令
za --version
zx --version
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 ISC 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🔗 相关链接

- [GitHub 仓库](https://github.com/cosin2077/za-7z)
- [问题反馈](https://github.com/cosin2077/za-7z/issues)
- [7-Zip 官网](https://www.7-zip.org/)

## 📈 版本历史

### v0.11.3 (当前版本)
- ✨ 新增安全密码存储功能
- ✨ 新增智能文件过滤（跳过 zip 文件）
- ✨ 新增删除警告提示
- ✨ 支持通配符批量处理
- 🐛 修复密码加密错误
- 🎨 改进用户界面和提示信息

### v0.11.2
- 🎯 基础压缩解压功能
- 🔐 密码保护支持
- 📁 批量文件处理

---

❤️ 如果这个工具对您有帮助，请给个星星！