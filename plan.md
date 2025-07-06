
我希望的效果如下，请帮我修改：

能配置密码，最好不在代码写死密码，第一次运行项目的时候可以让输入密码，或者具体执行命令的时候可以输入密码。

运行：
za .ssh
能把 .ssh 压缩成 .ssh.zip 并且加密

运行
za .ssh/* 能把 .ssh目录下的所有文件压缩，然后加密
比如：
.ssh/a.txt -> .ssh/a.txt.zip
.ssh/b.msi -> .ssh/a.msi.zip


zx .ssh.zip 能将 .ssh.zip 解压到 .ssh

zx .ssh/* 能将 .ssh 目录下所有zip解压到自己对应的文件或者文件夹


--sdel 或者 --del 参数为 删除成功压缩后的源文件
-p 或者 --password 能指定密码
