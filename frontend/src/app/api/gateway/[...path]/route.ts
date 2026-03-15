import { NextRequest, NextResponse } from "next/server";

const UPSTREAM = "https://gateway.sepolia.zama.ai";

// Rewrite absolute URLs in the keyurl JSON response to go through this proxy,
// so the browser never makes direct cross-origin requests to the gateway CDN.
function rewriteKeyurlResponse(json: unknown, origin: string): unknown {
  if (!json || typeof json !== "object") return json;
  const obj = json as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === "string" && val.startsWith("http")) {
      // Replace upstream URL with our proxy
      obj[key] = `${origin}/api/gateway/proxy?url=${encodeURIComponent(val)}`;
    } else if (Array.isArray(val)) {
      obj[key] = val.map((item) =>
        typeof item === "string" && item.startsWith("http")
          ? `${origin}/api/gateway/proxy?url=${encodeURIComponent(item)}`
          : rewriteKeyurlResponse(item, origin)
      );
    } else if (typeof val === "object" && val !== null) {
      obj[key] = rewriteKeyurlResponse(val, origin);
    }
  }
  return obj;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const pathStr = params.path.join("/");

  // Special: proxy a raw URL for public key / CRS binary downloads
  if (pathStr === "proxy") {
    const target = req.nextUrl.searchParams.get("url");
    if (!target) return NextResponse.json({ error: "missing url" }, { status: 400 });
    const res = await fetch(target);
    const data = await res.arrayBuffer();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const url = `${UPSTREAM}/${pathStr}${req.nextUrl.search}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const contentType = res.headers.get("Content-Type") ?? "";

    if (pathStr === "keyurl" && contentType.includes("json")) {
      // Rewrite embedded URLs so all key downloads also go through this proxy
      const json = await res.json();
      const origin = req.nextUrl.origin;
      const rewritten = rewriteKeyurlResponse(json, origin);
      return NextResponse.json(rewritten, {
        status: res.status,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const data = await res.arrayBuffer();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const pathStr = params.path.join("/");
  const url = `${UPSTREAM}/${pathStr}`;
  try {
    const body = await req.arrayBuffer();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": req.headers.get("Content-Type") ?? "application/json",
        Accept: "application/json",
      },
      body,
    });
    const data = await res.arrayBuffer();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
