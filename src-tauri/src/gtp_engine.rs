use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};

pub struct GtpEngine {
    child: Child,
    reader: BufReader<std::process::ChildStdout>,
}

impl GtpEngine {
    pub fn spawn(program: &str, args: &[&str]) -> Result<Self, String> {
        let mut child = Command::new(program)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("无法启动 {program}: {e}"))?;

        let stdout = child.stdout.take().ok_or("无法读取引擎输出")?;
        let mut engine = Self {
            child,
            reader: BufReader::new(stdout),
        };
        engine.handshake()?;
        Ok(engine)
    }

    fn handshake(&mut self) -> Result<(), String> {
        self.send("name")?;
        self.send("version")?;
        Ok(())
    }

    pub fn send(&mut self, cmd: &str) -> Result<String, String> {
        let stdin = self.child.stdin.as_mut().ok_or("引擎 stdin 不可用")?;
        writeln!(stdin, "{cmd}").map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;
        self.read_response()
    }

    fn read_response(&mut self) -> Result<String, String> {
        let mut lines = Vec::new();
        loop {
            let mut line = String::new();
            self.reader
                .read_line(&mut line)
                .map_err(|e| e.to_string())?;
            if line.trim().is_empty() {
                break;
            }
            lines.push(line.trim_end().to_string());
        }

        if lines.is_empty() {
            return Err("引擎无响应".into());
        }

        let first = &lines[0];
        if first.starts_with('?') {
            return Err(lines.join("\n"));
        }

        if first.starts_with('=') {
            let mut body = first.trim_start_matches('=').trim().to_string();
            for extra in lines.iter().skip(1) {
                if !body.is_empty() {
                    body.push('\n');
                }
                body.push_str(extra);
            }
            return Ok(body);
        }

        Ok(lines.join("\n"))
    }
}

impl Drop for GtpEngine {
    fn drop(&mut self) {
        let _ = self.send("quit");
        let _ = self.child.kill();
    }
}

pub fn col_to_letter(x: usize) -> char {
    let mut c = b'A' + x as u8;
    if c >= b'I' {
        c += 1;
    }
    c as char
}

pub fn letter_to_col(ch: char) -> Option<usize> {
    let upper = ch.to_ascii_uppercase();
    if !upper.is_ascii_alphabetic() {
        return None;
    }
    let mut idx = (upper as u8).saturating_sub(b'A') as usize;
    if upper >= 'I' {
        idx = idx.saturating_sub(1);
    }
    Some(idx)
}

pub fn to_gtp_coord(x: usize, y: usize, size: usize) -> String {
    format!("{}{}", col_to_letter(x), size - y)
}

pub fn parse_gtp_coord(raw: &str, size: usize) -> Option<(usize, usize)> {
    let token = raw.trim().to_lowercase();
    if token == "pass" || token == "resign" {
        return None;
    }
    let mut chars = token.chars();
    let col_ch = chars.next()?;
    let row: usize = chars.collect::<String>().parse().ok()?;
    let x = letter_to_col(col_ch)?;
    if row == 0 || row > size || x >= size {
        return None;
    }
    Some((x, size - row))
}
