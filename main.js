const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;
const fs = require("fs");
const readline = require("readline");
const { forEachSeries } = require("p-iteration");

console.log("PATH", { ffmpegPath, ffprobePath });

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question(
  "Enter the absolute path of the folder containing MP4 files: ",
  (folderPath) => {
    console.log("trying to grab all mp4 files inside ", folderPath);
    fs.readdir(folderPath, (err, files) => {
      if (err) {
        console.error("Error reading the folder:", err);
        return;
      }

      // un processed files
      const mp4Files = files.filter(
        (file) => file.endsWith(".mp4") && !file.includes("reduced_")
      );

      console.log("Total files: ", mp4Files.length);

      forEachSeries(mp4Files, async (file, index) => {
        const inputPath = `${folderPath}/${file}`;
        const outputPath = `${folderPath}/reduced_${file}`;
        try {
          console.log("start processing file:", inputPath);
          await reduceFileSize(inputPath, outputPath);
          await removeFile(inputPath);
          console.log("finished processing file:", outputPath);
        } catch (e) {
          console.log("ERROR", inputPath, e);
        } finally {
          if (index === mp4Files.length - 1) {
            process.exit(0);
          }
        }
      });

      rl.close();
    });
  }
);

async function reduceFileSize(filePath, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const metadata = await getMetadata(filePath);
      const bitrate = whatBitrate(metadata.format.size);

      ffmpeg(filePath)
        .outputOptions([
          "-c:v libx264",
          `-b:v ${bitrate}k`,
          "-c:a aac",
          "-b:a 58k",
        ])
        .output(outputPath)
        .on("start", (command) => {
          console.log("TCL: command -> command", command);
        })
        .on("error", (error) => reject(error))
        .on("end", () => resolve())
        .run();
    } catch (error) {
      console.log("ERROR GLOBAL", error);
      reject(error);
    }
  });
}

async function getMetadata(path) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(path, (err, metadata) => {
      if (err) {
        reject(err);
      }
      resolve(metadata);
    });
  });
}

function whatBitrate(bytes) {
  console.log("whatBitrate", bytes);
  const ONE_MB = 1000000;
  const BIT = 28; // i found that 28 are good point fell free to change it as you feel right
  const diff = Math.floor(bytes / ONE_MB);
  if (diff < 5) {
    return 128;
  } else {
    return Math.floor(diff * BIT * 1.1);
  }
}

async function removeFile(path) {
  return new Promise((r, j) => {
    fs.unlink(path, (e) => {
      if (e) {
        return j(e);
      }

      r();
    });
  });
}
