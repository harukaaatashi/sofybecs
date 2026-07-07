// 内部限定化ゲート（Vercel Edge Middleware / Hobbyプラン可）。
//
// 全アクセスに Basic 認証をかけ、本番ドメインも含めて非公開にする。
// 合言葉は環境変数で設定する:
//   SITE_PASSWORD … 必須。未設定のときは安全側に倒して全拒否する。
//   SITE_USER     … 任意。既定は "sofybe"。
//
// 共有方法: チームには URL と SITE_USER / SITE_PASSWORD を渡すだけ。
// ブラウザのログインダイアログで入力すればよい。

export const config = {
  // robots.txt などを含む全経路を保護する。
  matcher: "/:path*",
};

function unauthorized() {
  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="sofybe internal", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

export default function middleware(request) {
  const expectedPassword = process.env.SITE_PASSWORD || "";
  const expectedUser = process.env.SITE_USER || "sofybe";

  // 合言葉が未設定なら「内部限定」を保証できないため全拒否（fail closed）。
  if (!expectedPassword) {
    return unauthorized();
  }

  const header = request.headers.get("authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) {
    return unauthorized();
  }

  let decoded = "";
  try {
    decoded = atob(encoded);
  } catch {
    return unauthorized();
  }

  const sep = decoded.indexOf(":");
  const user = sep === -1 ? decoded : decoded.slice(0, sep);
  const password = sep === -1 ? "" : decoded.slice(sep + 1);

  if (user !== expectedUser || password !== expectedPassword) {
    return unauthorized();
  }

  // 認証OK。通常配信へ通す。
}
