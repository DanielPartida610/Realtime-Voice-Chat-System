export function healthCheck(req, res) {
    res.json({ ok: true, message: "Server healthy ✅" });
  }