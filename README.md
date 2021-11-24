# workflow_dispatch-worker

[`workflow_dispatch-worker`](https://github.com/dnasdw/workflow_dispatch-worker) 是通过 [`worker-template`](https://github.com/cloudflare/worker-template) 模板创建的。

```Shell
wrangler generate workflow_dispatch-worker https://github.com/cloudflare/worker-template
```

这是一个可以部署在`cloudflare`上的worker模板。

这个worker可以接收`github`仓库`A`的webhooks推送，然后触发`github`仓库`B`的actions。

## 限制

- 只能处理`push`事件的webhooks推送，除非日后更新。

- 由于webhooks属于仓库，所以`github`仓库`A`的webhooks推送只能触发`github`仓库`B`同名分支的actions，除非日后更新。

## 前提

- `github`的账号和`cloudflare`的账号。

- `github`仓库`A`设置webhooks的权限。

- `github`仓库`B`设置actions的权限。

- 由于调用`github`的API需要认证，所以需要`github`账号的`Personal access token(选中整个repo范围)`，以下简称`PAT`。

## 假设

- `github`仓库`A`的地址为`https://github.com/owner_c/repo_a`，添加新webhook的地址为`https://github.com/owner_c/repo_a/settings/hooks/new`。

- `github`仓库`B`的地址为`https://github.com/owner_d/repo_b`，包含一个`/.github/workflows/action-e.yml`的actions配置。

- `cloudflare`的子域名为`owner_f.workers.dev`。

- `cloudflare`的worker名为`workerg`。

- 那么`github`仓库`A`新添加的webhook的`Payload URL`为`https://workerg.owner_f.workers.dev/api/github/repos/owner_d/repo_b/actions/workflows/action-e.yml/dispatches`。

- `github`仓库`A`上述webhook的`Secret`为`secret_h`。

## 用法

### 生成`PAT`

- 访问<https://github.com/settings/tokens/new>。

- `Note`随便填一个容易记的备注，比如`forWorker`。

- `Expiration`过期时间选一个能接受的，如果不想以后频繁改，那就选`github`**不推荐**的`No expiration(不过期)`。

- 范围直接勾选`repo`，会自动包含其下的子范围。

- 会得到一串以`ghp_`开头的token字符串，临时记录一下，**千万不要将此token外泄，比如不要将其提交推送到公开仓库中**。**千万不要将此token外泄，比如不要将其提交推送到公开仓库中**。**千万不要将此token外泄，比如不要将其提交推送到公开仓库中**。否则只能删除来避免损失，然后再重新生成一个新的`PAT`。

### 添加worker

- 方法一：直接在网页端操作。

  - 访问<https://dash.cloudflare.com/?account=workers>。

  - 点击`Create a service`按钮添加worker。

  - `Service name`可以改成一个容易记忆的短名字，比如前面**假设**中用的`workerg`。

  - `starter`模板选择`HTTP handler`，也就是最短的那个`Hello world`模板。

  - 添加以后点击Worker右侧的`快速编辑`。

  - 将本项目`index.js`中的内容复制到在线的编辑器中，点击`保存并部署`。

  - 返回上一页Worker页面，点击`设置`，点击`Variables`标签页，点击`环境变量`中的`添加变量`按钮。

  - 添加一个`变量名称`为`GITHUB_TOKEN`，`值`为前面生成的`PAT`，并加密的变量，在网页端更新加密变量需要先删除再重新添加。

  - 再添加一个`变量名称`为`GITHUB_WEBHOOK_SECRET`，`值`为`github`仓库`A`中webhook的`Secret`，并加密的变量，比如前面**假设**中用的`secret_h`，在网页端更新加密变量需要先删除再重新添加。**如果不想校验签名，此变量可以不添加。**

  - 点击`环境变量`中的`保存`按钮。

- 方法二：通过命令行工具(Wrangler)操作。

  - 安装Wrangler。

  ```Shell
  npm install -g @cloudflare/wrangler
  ```

  - 登录cloudflare账号。

  ```Shell
  wrangler login
  ```

  - 在本地创建worker，给worker起个名，比如前面**假设**中用的`workerg`，并进入项目目录。

  ```Shell
  wrangler generate workerg https://github.com/dnasdw/workflow_dispatch-worker
  cd workerg
  ```

  - 给worker添加环境变量`GITHUB_TOKEN`，内容为前面生成的`PAT`，以后更新也是这么执行。

  ```Shell
  wrangler secret put GITHUB_TOKEN
  ```

  - 给worker添加环境变量`GITHUB_WEBHOOK_SECRET`，内容为`github`仓库`A`中webhook的`Secret`，比如前面**假设**中用的`secret_h`，以后更新也是这么执行，删除是将`put`改为`delete`。**如果不想校验签名，此变量可以不添加。**

  ```Shell
  wrangler secret put GITHUB_WEBHOOK_SECRET
  ```

  - 发布worker。

  ```Shell
  wrangler publish
  ```

### 添加webhook

- 访问`github`仓库`A`的webhooks并添加一个新的webhook，比如前面**假设**中的`https://github.com/owner_c/repo_a/settings/hooks/new`。

- 填写`Payload URL`，比如前面**假设**中的`https://workerg.owner_f.workers.dev/api/github/repos/owner_d/repo_b/actions/workflows/action-e.yml/dispatches`。

- `Content type`选择`application/json`。

- 填写`Secret`，比如前面**假设**中的`secret_h`。**如果不想校验签名，此处可以不填写。**

- `SSL verification`选择`Enable SSL verification`。

- `Which events would you like to trigger this webhook?`选择`Just the push event.`。

- 勾选`Active`。

- 点击`Add webhook`。

### 添加或修改actions

- 在actions的配置`on:`中增加`workflow_dispatch:`，`inputs`部分是可选的，根据是否使用`inputs`参数来选择是否加入这部分。

```Text
on:
  workflow_dispatch:
    inputs:
      commit_id:
        description: The commit id of the trigger repository.
        required: false
        default:
```

### 完成

---

以下是[`worker-template`](https://github.com/cloudflare/worker-template) 自带的README。

---

# 👷 `worker-template` Hello World

A template for kick starting a Cloudflare worker project.

[`index.js`](https://github.com/cloudflare/worker-template/blob/master/index.js) is the content of the Workers script.

#### Wrangler

To generate using [wrangler](https://github.com/cloudflare/wrangler)

```
wrangler generate projectname https://github.com/cloudflare/worker-template
```

Further documentation for Wrangler can be found [here](https://developers.cloudflare.com/workers/tooling/wrangler).
