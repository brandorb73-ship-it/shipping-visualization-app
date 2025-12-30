export default function handler(req, res) {
  const { password } = JSON.parse(req.body);
  if (password === process.env.APP_PASSWORD) {
    res.status(200).json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
}
