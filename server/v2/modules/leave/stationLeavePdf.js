/**
 * Hostel/05 Station Leave PDF - Docker + XeLaTeX (`latex/station_leave.tex`).
 *
 * Requires:
 *   - Docker on the host running Node
 *   - STATION_LEAVE_LATEX_IMAGE (e.g. iitg-station-leave-latex:local). See `latex/docker/Dockerfile`.
 * Optional:
 *   - STATION_LEAVE_DOCKER_BIN (default: docker)
 *   - STATION_LEAVE_LATEX_TIMEOUT_MS (default: 120000)
 *   - latex/iitg_logo.png or latex/IITG_logo.png (copied as iitg_logo.png for TeX; else placeholder rule)
 */

import fs from "fs";
import fs_725 from "fs";
const fsp = fs_725.promises;
import path from "path";
const __dirname = import.meta.dirname;
import os from "os";
import { spawn } from "child_process";
import { stationLeave } from "../../config/default.js";

const LOG_PDF = "[Leave][pdf]";

const TEMPLATE_PATH = path.join(__dirname, "latex", "station_leave.tex");
const LATEX_DIR = path.join(__dirname, "latex");

/** TeX expects `iitg_logo.png` in the compile dir; accept common on-disk names. */
function resolveLogoSourcePath() {
  const candidates = [
    path.join(LATEX_DIR, "iitg_logo.png"),
    path.join(LATEX_DIR, "IITG_logo.png"),
    path.join(LATEX_DIR, "iitg_logo.PNG"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const COMPILE_TIMEOUT_MS = Number(stationLeave.latexTimeout) || 120000;

/** Escape user-supplied text for LaTeX (tables / parbox). */
export function latexEscape(s) {
  if (s == null || s === undefined) return "";
  let t = String(s);
  t = t.replace(/\\/g, "\\textbackslash{}");
  t = t.replace(/\{/g, "\\{");
  t = t.replace(/\}/g, "\\}");
  t = t.replace(/\$/g, "\\$");
  t = t.replace(/#/g, "\\#");
  t = t.replace(/%/g, "\\%");
  t = t.replace(/&/g, "\\&");
  t = t.replace(/_/g, "\\_");
  t = t.replace(/\^/g, "\\textasciicircum{}");
  t = t.replace(/~/g, "\\textasciitilde{}");
  return t.replace(/\r?\n/g, " \\newline ");
}

/** Bank A/c no. / IFSC: show "Not Applicable" when missing or placeholder dashes. */
function latexBankAccountField(v) {
  if (v == null || v === undefined) return latexEscape("Not Applicable");
  const t = String(v).trim();
  if (t === "" || t === "--" || t === "-" || /^[\s\-–-]+$/.test(t)) {
    return latexEscape("Not Applicable");
  }
  return latexEscape(t);
}

function runDockerCompile(workDir, image, dockerBin) {
  return new Promise((resolve, reject) => {
    const shellCmd =
      "xelatex -interaction=nonstopmode -halt-on-error station_leave.tex && " +
      "xelatex -interaction=nonstopmode -halt-on-error station_leave.tex";
    const args = [
      "run",
      "--rm",
      "-v",
      `${workDir}:/work`,
      "-w",
      "/work",
      image.trim(),
      "sh",
      "-c",
      shellCmd,
    ];
    const child = spawn(dockerBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let stdout = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`LaTeX compile exceeded ${COMPILE_TIMEOUT_MS}ms`));
    }, COMPILE_TIMEOUT_MS);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const tail = (stderr + "\n" + stdout).slice(-6000);
        reject(
          new Error(`XeLaTeX failed (exit ${code}). Last output:\n${tail}`),
        );
      } else resolve();
    });
  });
}

/**
 * @param {Record<string, unknown>} data - same fields as `leaveController` pdfPayload
 * @returns {Promise<Buffer>}
 */
export async function buildStationLeavePdf(data) {
  const image = stationLeave.latexImage;
  if (!image || !String(image).trim()) {
    console.error(`${LOG_PDF} STATION_LEAVE_LATEX_IMAGE is not set`);
    throw new Error(
      "STATION_LEAVE_LATEX_IMAGE must be set (Docker image tag for XeLaTeX). Example: iitg-station-leave-latex:local",
    );
  }
  const dockerBin = stationLeave.dockerBin;
  const roll = String(data.rollNo ?? "").trim();
  const refId = roll.length >= 4 ? `…${roll.slice(-4)}` : roll || "(no roll)";

  console.log(`${LOG_PDF} build start`, {
    refId,
    image: String(image).trim(),
    dockerBin: dockerBin || "docker",
    timeoutMs: COMPILE_TIMEOUT_MS,
  });

  let tex = await fsp.readFile(TEMPLATE_PATH, "utf8");

  const regSemCell = data.registeredCurrentSem
    ? "\\textbf{Yes} \\checkmark"
    : "No";

  const contactRaw = String(data.contactDuringLeave || "").trim();
  const lines = contactRaw.split(/\r?\n/).filter(Boolean);
  const contactLine1 = lines[0] ? latexEscape(lines[0]) : latexEscape("-");

  /** Second address row: omit placeholder dashes; use invisible strut if unused. */
  let contactLine2 = "\\strut";
  if (lines.length > 1) {
    const tail = lines.slice(1).join(" ").trim();
    const isPlaceholder =
      tail === "" || tail === "--" || tail === "-" || /^[\s\-–-]+$/.test(tail);
    if (!isPlaceholder) {
      contactLine2 = latexEscape(tail);
    }
  }

  const map = {
    "@@STUDENT_NAME@@": latexEscape(data.studentName),
    "@@ROLL_NO@@": latexEscape(data.rollNo),
    "@@DEPT@@": latexEscape(data.dept),
    "@@PROGRAMME@@": latexEscape(data.programme),
    "@@SEMESTER@@": latexEscape(data.semesterLabel),
    "@@RESIDENT_HOSTEL@@": latexEscape(data.residentHostel),
    "@@ROOM_NO@@": latexEscape(data.roomNo),
    "@@EMAIL@@": latexEscape(data.email),
    "@@MOBILE@@": latexEscape(data.mobile),
    "@@REG_SEM_CELL@@": regSemCell,
    "@@HOME_ADDRESS@@": latexEscape(data.homeAddress),
    "@@CONTACT_LINE1@@": contactLine1,
    "@@CONTACT_LINE2@@": contactLine2,
    "@@CONTACT_PHONE@@": latexEscape(data.contactPhone),
    "@@BANK_AC_NAME@@": latexEscape(data.bankAcName),
    "@@BANK_NAME@@": latexEscape(data.bankName),
    "@@BANK_AC_NO@@": latexBankAccountField(data.bankAcNo),
    "@@BANK_IFSC@@": latexBankAccountField(data.bankIfsc),
    "@@PURPOSE@@": latexEscape(data.purpose),
    "@@DATE_FROM@@": latexEscape(data.dateFromStr),
    "@@DATE_TO@@": latexEscape(data.dateToStr),
    "@@LEAVE_TIME@@": latexEscape(data.leaveTimeStr),
    "@@IN_TIME@@": latexEscape(data.inTimeStr),
    "@@TOTAL_DAYS@@": latexEscape(data.totalDays),
    "@@SUBSCRIBED_MESS@@": latexEscape(data.subscribedMess),
    "@@MESS_MANAGER@@": "Not Applicable",
    "@@MESS_DATE@@": "Not Applicable",
    "@@MESS_TIME@@": "Not Applicable",
    "@@APPLIED_DATE@@": latexEscape(data.appliedDateStr),
  };

  for (const [token, value] of Object.entries(map)) {
    tex = tex.split(token).join(value);
  }
  const unfilled = [...tex.matchAll(/@@[A-Z][A-Z0-9_]*@@/g)].map((m) => m[0]);
  if (unfilled.length) {
    console.error(`${LOG_PDF} unfilled LaTeX placeholders`, {
      refId,
      placeholders: [...new Set(unfilled)],
    });
    throw new Error(
      `Unfilled LaTeX placeholders: ${[...new Set(unfilled)].join(", ")}`,
    );
  }

  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), "station-leave-"));
  console.log(`${LOG_PDF} temp dir`, { refId, workDir: path.basename(workDir) });
  try {
    await fsp.writeFile(path.join(workDir, "station_leave.tex"), tex, "utf8");
    const logoSrc = resolveLogoSourcePath();
    if (logoSrc) {
      await fsp.copyFile(logoSrc, path.join(workDir, "iitg_logo.png"));
      console.log(`${LOG_PDF} logo copied`, { refId, logo: path.basename(logoSrc) });
    } else {
      console.warn(`${LOG_PDF} no logo file in latex/ (optional)`, { refId });
    }
    const t0 = Date.now();
    console.log(`${LOG_PDF} docker xelatex starting`, { refId });
    await runDockerCompile(workDir, image, dockerBin);
    console.log(`${LOG_PDF} docker xelatex done`, {
      refId,
      ms: Date.now() - t0,
    });
    const pdfPath = path.join(workDir, "station_leave.pdf");
    const buf = await fsp.readFile(pdfPath);
    console.log(`${LOG_PDF} pdf ready`, { refId, bytes: buf.length });
    return buf;
  } catch (err) {
    console.error(`${LOG_PDF} failed`, {
      refId,
      message: err?.message,
      name: err?.name,
    });
    throw err;
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export {};
