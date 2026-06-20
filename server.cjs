var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "10mb" }));
var apiKey = process.env.GEMINI_API_KEY;
var ai = null;
if (apiKey) {
  ai = new import_genai.GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
} else {
  console.warn("GEMINI_API_KEY is not defined in environment variables.");
}
app.post("/api/gemini/storyboard", async (req, res) => {
  try {
    const { prompt, vibe, category } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    if (!ai) {
      return res.status(500).json({
        error: "Gemini AI is not initialized. Please configure GEMINI_API_KEY."
      });
    }
    const systemInstruction = `You are an expert social media vertical video producer specializing in 15-second high-conversion videos (Reels, TikTok, Shorts).
Your task is to generate a comprehensive 15-second storyboard containing EXACTLY 15 frames (1 second per frame, labeled 1 to 15).
Deliver the output in Indonesian, optimized for high dynamic engagement. Ensure the sequential captions are highly engaging, starting with a strong hook in seconds 1-3, maintaining problem-solving in seconds 4-10, climax/payoff in 11-13, and a clear, catchy call-to-action (CTA) in seconds 14-15.
Choose dynamic color gradients and abstract background patterns that suit the specified Vibe (${vibe || "modern & clean"}) and Category (${category || "Promo"}).`;
    const userPrompt = `Generate a 15-seconds frame storyboard sequence for the following video concept: "${prompt}". 
Ensure there are exactly 15 consecutive seconds elements (from 1 to 15). Each representing exactly 1 second.`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            videoTitle: {
              type: import_genai.Type.STRING,
              description: "Catchy title for this 15-second video storyboard."
            },
            vibeDescription: {
              type: import_genai.Type.STRING,
              description: "A brief description of the mood / visual style suggested."
            },
            themeCategory: {
              type: import_genai.Type.STRING,
              description: "The primary category (e.g., Promosi, Edukasi, Inspirasi, Komedi)"
            },
            frames: {
              type: import_genai.Type.ARRAY,
              description: "Must contain EXACTLY 15 elements, corresponding to second 1 to 15 sequentially.",
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  second: {
                    type: import_genai.Type.INTEGER,
                    description: "The time index in seconds, from 1 to 15."
                  },
                  visualDescription: {
                    type: import_genai.Type.STRING,
                    description: "Detailed description of what the background or visuals look like (in Indonesian)."
                  },
                  captionText: {
                    type: import_genai.Type.STRING,
                    description: "Strictly concise caption overlay text (maximum 12 words) to display visually (in Indonesian)."
                  },
                  captionPosition: {
                    type: import_genai.Type.STRING,
                    description: "Ideal placement on screen: 'top', 'middle', 'bottom'."
                  },
                  captionStyle: {
                    type: import_genai.Type.STRING,
                    description: "Styling variant: 'bold-white', 'neon-yellow', 'caps-badge', 'shadow-red', 'gradient-text'."
                  },
                  iconName: {
                    type: import_genai.Type.STRING,
                    description: "Suggested standard Lucide Icon name representing this action (e.g. Sparkles, TrendingUp, Flame, Play, Star, AlertTriangle, Lightbulb, CheckCircle, Heart, Phone, ArrowRight, Video, Target, Award, Users). Return a valid camelCase lucide icon or capitalize like CheckCircle."
                  },
                  bgColorStart: {
                    type: import_genai.Type.STRING,
                    description: "Hex code starting color for background gradient (e.g. #ff007f or #111827). Make sure color matches the requested vibe."
                  },
                  bgColorEnd: {
                    type: import_genai.Type.STRING,
                    description: "Hex code ending color for background gradient (e.g. #7e22ce or #1f2937)."
                  },
                  bgPattern: {
                    type: import_genai.Type.STRING,
                    description: "Abstract decoration overlay style: 'abstract', 'grid', 'radial', 'dots', 'minimal'."
                  },
                  textAnim: {
                    type: import_genai.Type.STRING,
                    description: "Visual animation for text entry: 'fade', 'slide-up', 'scale', 'bounce'."
                  }
                },
                required: [
                  "second",
                  "visualDescription",
                  "captionText",
                  "captionPosition",
                  "captionStyle",
                  "iconName",
                  "bgColorStart",
                  "bgColorEnd",
                  "bgPattern",
                  "textAnim"
                ]
              }
            }
          },
          required: ["videoTitle", "vibeDescription", "themeCategory", "frames"]
        }
      }
    });
    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Empty response from Gemini");
    }
    const parsedData = JSON.parse(textOutput.trim());
    return res.json(parsedData);
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message || error
    });
  }
});
app.get("/api/proxy-video", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send("Parameter 'url' is required.");
  }
  try {
    const parsedUrl = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).send("Invalid protocol.");
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Origin, Content-Type, Accept");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
    if (req.headers.range) {
      headers["Range"] = req.headers.range;
    }
    const targetResponse = await fetch(targetUrl, {
      method: "GET",
      headers
    });
    if (!targetResponse.ok && targetResponse.status !== 206) {
      return res.status(targetResponse.status).send(`Upstream server error: ${targetResponse.statusText}`);
    }
    const contentType = targetResponse.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    } else {
      res.setHeader("Content-Type", "video/mp4");
    }
    const contentRange = targetResponse.headers.get("content-range");
    if (contentRange) {
      res.setHeader("Content-Range", contentRange);
    }
    const contentLength = targetResponse.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }
    const acceptRanges = targetResponse.headers.get("accept-ranges");
    if (acceptRanges) {
      res.setHeader("Accept-Ranges", acceptRanges);
    } else {
      res.setHeader("Accept-Ranges", "bytes");
    }
    res.status(targetResponse.status);
    if (targetResponse.body) {
      const reader = targetResponse.body.getReader();
      const pump = async () => {
        try {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          res.write(Buffer.from(value));
          pump();
        } catch (streamErr) {
          console.error("Stream pipe failed:", streamErr);
          res.end();
        }
      };
      pump();
    } else {
      res.end();
    }
  } catch (error) {
    console.error("Video proxy failed error:", error);
    res.status(500).send(`CORS Video Proxy failed: ${error.message}`);
  }
});
app.get("/api/pinterest-parser", async (req, res) => {
  const pinUrl = req.query.url;
  if (!pinUrl) {
    return res.status(400).json({ error: "Parameter 'url' is required." });
  }
  try {
    const response = await fetch(pinUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "id-ID,en-US,en;q=0.5"
      }
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Gagal mengakses halaman Pinterest (Status: ${response.status})` });
    }
    const html = await response.text();
    const regex = /(https?:\\?\/\\?\/[^\s"'`<>]*pinimg\.com\\?\/videos\\?\/[^\s"'`<>]*\.mp4[^\s"'`<>]*)/gi;
    const matches = html.match(regex);
    if (matches && matches.length > 0) {
      let directUrl = matches[0].replace(/\\/g, "");
      directUrl = directUrl.replace(/&amp;/g, "&");
      return res.json({
        success: true,
        directUrl,
        proxiedUrl: `/api/proxy-video?url=${encodeURIComponent(directUrl)}`
      });
    }
    const altRegex = /"video"[^}]*"url"\s*:\s*"([^"]+\.mp4[^"]*)"/i;
    const altMatch = html.match(altRegex);
    if (altMatch && altMatch[1]) {
      const url = altMatch[1].replace(/\\/g, "").replace(/&amp;/g, "&");
      return res.json({
        success: true,
        directUrl: url,
        proxiedUrl: `/api/proxy-video?url=${encodeURIComponent(url)}`
      });
    }
    return res.status(404).json({
      success: false,
      error: "Tidak dapat mengekstrak berkas MP4 mentah dari Pin Pinterest tersebut. Pastikan link adalah benar-benar Pin Video yang berputar."
    });
  } catch (err) {
    console.error("Pinterest parser failed:", err);
    return res.status(500).json({ error: `System Error mengekstrak Pinterest: ${err.message}` });
  }
});
async function setupViteAndStatic() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on http://localhost:${PORT}`);
  });
}
setupViteAndStatic();
//# sourceMappingURL=server.cjs.map
