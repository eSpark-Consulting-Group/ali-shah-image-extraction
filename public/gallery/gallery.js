// Array of image URLs
const images = [
  "https://example.com/image1.jpg",
  "https://example.com/image2.jpg",
  "https://example.com/image3.jpg",
];

// Function to display images
function showImages(imageArray) {
  const container = document.getElementById("image-container");

  // Clear the container if needed
  container.innerHTML = "";

  // Loop through the image array and create elements for each image and title
  imageArray.forEach((image) => {
    const imgWrapper = document.createElement("div");
    imgWrapper.classList.add("image-wrapper");
    imgWrapper.style.margin = "10px"; // Add some spacing (optional)

    const img = document.createElement("img");
    img.src = image.url;
    img.alt = image.title;
    img.style.width = "400px";
    img.style.height = "250px";

    const title = document.createElement("p");
    title.textContent = image.title;
    title.style.marginLeft = "15px";

    const downloadButton = document.createElement("button");
    downloadButton.className = "download-btn";
    downloadButton.textContent = "Download";
    downloadButton.style.display = "block"; // Optional styling
    console.log(image.url, "asgdasgdsadsaxsd");
    downloadButton.onclick = () => downloadImage(image.url);

    const buttonWrapper = document.createElement("div");
    buttonWrapper.classList.add("button-wrapper");
    buttonWrapper.appendChild(title);
    buttonWrapper.appendChild(downloadButton);

    // Append image and title to the wrapper, then add to the container
    imgWrapper.appendChild(img);
    imgWrapper.appendChild(buttonWrapper);
    // imgWrapper.appendChild(downloadButton);
    container.appendChild(imgWrapper);
  });
}

async function downloadImage(url) {
  try {
    // Fetch the image as a blob
    const response = await fetch(url);
    const blob = await response.blob();

    // Create a temporary URL for the blob
    const blobUrl = URL.createObjectURL(blob);

    // Create an anchor element and trigger download
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "downloaded_image.jpg"; // Set a custom filename here if desired
    document.body.appendChild(link);
    link.click();

    // Clean up by revoking the object URL and removing the link
    URL.revokeObjectURL(blobUrl);
    document.body.removeChild(link);
  } catch (error) {
    console.error("Download failed:", error);
  }
}

// Call the function to display images

function fetchScreenShots() {
  fetch(
    "http://localhost:8000/snapshots?" +
      new URLSearchParams({
        pageSize: 20,
      }).toString(),
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        Cookie:
          "connect.sid=s%3A2WoltB_jsGh7-WAu-yBqoA7HVEuD73Oo.7GGLXylrKaRmLoSxrH2euQp50hrsQCpFuCaeZ%2F37lto",
      },
    }
  )
    .then((response) => response.json())
    .then((data) => {
      const imageArr = data.items.map((val) => {
        return {
          url: val.snapShot.url,
          title: val.createdAt,
        };
      });
      showImages(imageArr);
    })
    .catch((error) => console.error("Error:", error));
}

fetchScreenShots();
