/* eslint-disable prettier/prettier */
const multer = require("multer");
const Path = require("path");

const fileFilter = (req, file, callback) => {
  const acceptableExt = [".png", ".jpg", ".jpeg"];
  if (!acceptableExt.includes(Path.extname(file.originalname))) {
  }
  const fileSize = parseInt(req.headers["content-length"]);
  if (fileSize > 1048576) {
    return callback(new Error("File Size Big"));
  }

  callback(null, true);
};

let upload = multer({
  fileFilter: fileFilter,
  fileSize: 1048576,
});

const singleImage = upload.single("avatar");

module.exports = { singleImage };
