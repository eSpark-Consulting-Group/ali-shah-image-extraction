const { v2: cloudinary } = require("cloudinary");
const { v4: uuid } = require("uuid");

// Convert file buffer to Base64
const getBase64 = (file) => {
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
};

// Upload files to Cloudinary
const uploadFilesToCloudinary = async (files = []) => {
  if (files.length === 0) {
    throw new Error("Missing required parameter - files");
  }

  const uploadPromises = files.map((file) => {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        getBase64(file),
        {
          resource_type: "auto",
          public_id: uuid(),
        },
        (err, result) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        }
      );
    });
  });

  try {
    const results = await Promise.all(uploadPromises);
    return results.map((result) => ({
      public_id: result.public_id,
      url: result.secure_url,
    }));
  } catch (err) {
    throw new Error(`Error uploading files: ${err.message}`);
  }
};

module.exports = { uploadFilesToCloudinary };
