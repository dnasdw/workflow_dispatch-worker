// references:
//   github webhooks:
//     https://docs.github.com/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#push
//     https://docs.github.com/developers/webhooks-and-events/webhooks/securing-your-webhooks#validating-payloads-from-github
//     https://developers.cloudflare.com/workers/examples/signing-requests#generating-signed-requests
//     https://stackoverflow.com/questions/47329132/how-to-get-hmac-with-crypto-web-api
//   github actions:
//     https://docs.github.com/actions/learn-github-actions/events-that-trigger-workflows#workflow_dispatch
//     https://docs.github.com/rest/reference/actions#create-a-workflow-dispatch-event

// https://docs.github.com/rest/overview/resources-in-the-rest-api
const GITHUB_API_URL = "https://api.github.com";

const API_GITHUB = "/api/github/";

const encoder = new TextEncoder();

const GITHUB_WEBHOOK_SECRET_RAW = typeof GITHUB_WEBHOOK_SECRET != "undefined" ? encoder.encode(GITHUB_WEBHOOK_SECRET) : [];

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  console.log("-------- BEGIN >>>>>>>>");

  console.log(`request.method: ${request.method}`);
  if (request.method !== "POST") {
    console.log("<<<<<<<<  405  --------");
    return new Response(`Method ${request.method} not allowed`, {
      status: 405,
      headers: {
        "Allow": "POST"
      }
    });
  }

  console.log("request.header: {");
  request.headers.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  })
  console.log("}");

  const contentType = request.headers.get("Content-Type") || "";
  console.log(`Content-Type: ${contentType}`);
  if (!contentType.includes("application/") || !contentType.includes("json")) {
    console.log("<<<<<<<<  415  --------");
    return new Response(`Invalid Content-Type ${contentType}`, {
      status: 415,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  }

  const xGithubEvent = request.headers.get("X-Github-Event") || "";
  console.log(`X-Github-Event: ${xGithubEvent}`);
  if (xGithubEvent !== "push") {
    console.log("<<<<<<<<  415  --------");
    return new Response(`Invalid X-Github-Event ${xGithubEvent}`, {
      status: 415,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  }

  const requestText = await request.text();

  const xHubSignature256 = request.headers.get("X-Hub-Signature-256") || "";
  console.log(`X-Hub-Signature-256: ${xHubSignature256}`);
  if (xHubSignature256 !== "" && typeof GITHUB_WEBHOOK_SECRET != "undefined") {
    let signature256 = "sha256=";
    await crypto.subtle.importKey(
      "raw",
      GITHUB_WEBHOOK_SECRET_RAW,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    ).then(key => {
      crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(requestText)
      ).then(signature => {
        let b = new Uint8Array(signature);
        signature256 += Array.prototype.map.call(b, x => ("00" + x.toString(16)).slice(-2)).join("");
      })
    })
    console.log(`signature256: ${signature256}`);

    if (xHubSignature256 !== signature256) {
      return new Response("Unauthorized", {
        status: 401,
        headers: {
          "Content-Type": "text/plain"
        }
      });
    }
  }

  const payload = JSON.parse(requestText);
  // console.log(`payload: ${JSON.stringify(payload)}`);

  const ref = payload.ref.split("/")[2];
  console.log(`ref: ${ref}`);

  const afterCommitId = payload.after || "";
  console.log(`afterCommitId: ${afterCommitId}`);

  console.log(`request.url: ${request.url}`);
  const { pathname } = new URL(request.url);
  console.log(`pathname: ${pathname}`);

  if (pathname.startsWith(API_GITHUB)) {
    const apiPath = pathname.substr(API_GITHUB.length - 1);
    console.log(`apiPath: ${apiPath}`);

    const response = await fetch(`${GITHUB_API_URL}${apiPath}`, {
      method: "POST",
      headers: {
        "Authorization": `token ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Cloudflare-Workers"
      },
      body: JSON.stringify({
        "ref": ref,
        "inputs": {
          "commit_id": afterCommitId
        }
      })
    });

    const responseText = await response.text();
    console.log(`responseText: ${responseText}`);

    console.log("<<<<<<<<  200  --------");
    return new Response(`OK ${response.status} ${responseText}`, {
      headers: {
        "Content-Type": "text/plain"
      },
    });
  }

  console.log("<<<<<<<<  404  --------");
  return new Response(`Not found ${pathname}`, {
    status: 404,
    headers: {
      "Content-Type": "text/plain"
    }
  });
}
