function showImages(imageArray) {
  const container = document.getElementById("image-container");

  container.innerHTML = "";

  imageArray.forEach((image) => {
    const imgWrapper = document.createElement("div");
    imgWrapper.classList.add("image-wrapper");
    imgWrapper.style.margin = "10px";

    const img = document.createElement("img");
    img.src = image.url;
    img.alt = image.title;
    img.style.width = "400px";
    img.style.height = "250px";

    const dateObj = new Date(image.title);
    const formattedDate = dateObj.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const title = document.createElement("p");
    title.textContent = formattedDate;
    title.style.marginLeft = "15px";

    const downloadButton = document.createElement("button");
    downloadButton.className = "download-btn";
    downloadButton.textContent = "Download";
    downloadButton.style.display = "block";
    downloadButton.onclick = () => downloadImage(image.url);

    const buttonWrapper = document.createElement("div");
    buttonWrapper.classList.add("button-wrapper");
    buttonWrapper.appendChild(title);
    buttonWrapper.appendChild(downloadButton);

    imgWrapper.appendChild(img);
    imgWrapper.appendChild(buttonWrapper);
    container.appendChild(imgWrapper);
  });
}

async function downloadImage(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "downloaded_image.jpg";
    document.body.appendChild(link);
    link.click();

    URL.revokeObjectURL(blobUrl);
    document.body.removeChild(link);
  } catch (error) {
    console.error("Download failed:", error);
  }
}

function showLoadingState(isLoading) {
  const button = document.getElementById("find-button");
  const skeletons = document.querySelectorAll(".skeleton");

  if (isLoading) {
    button.disabled = true;
    button.textContent = "Loading...";
    button.classList.add("loading");

    showSkeletons();
  } else {
    button.disabled = false;
    button.textContent = "Find";
    button.classList.remove("loading");

    skeletons.forEach((skeleton) => {
      skeleton.style.display = "none";
    });
  }
}

function showSkeletons() {
  const container = document.getElementById("image-container");
  container.innerHTML = "";

  for (let i = 0; i < 6; i++) {
    const imgWrapper = document.createElement("div");
    imgWrapper.classList.add("image-wrapper", "skeleton");

    const imgSkeleton = document.createElement("div");
    imgSkeleton.classList.add("skeleton-img");

    const titleSkeleton = document.createElement("div");
    titleSkeleton.classList.add("skeleton-text");

    const downloadButtonSkeleton = document.createElement("div");
    downloadButtonSkeleton.classList.add("skeleton-btn");

    const buttonWrapper = document.createElement("div");
    buttonWrapper.classList.add("button-wrapper");
    buttonWrapper.appendChild(titleSkeleton);
    buttonWrapper.appendChild(downloadButtonSkeleton);

    imgWrapper.appendChild(imgSkeleton);
    imgWrapper.appendChild(buttonWrapper);
    container.appendChild(imgWrapper);
  }
}

function fetchScreenShots(from = null, to = null) {
  showLoadingState(true);
  const statusMessage = document.getElementById("status-message");
  statusMessage.textContent = "";

  const params = new URLSearchParams({ pageSize: 20 });

  if (from) params.append("from", from);
  if (to) params.append("to", to);

  fetch(`http://localhost:8000/snapshots?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      Cookie:
        "connect.sid=s%3A2WoltB_jsGh7-WAu-yBqoA7HVEuD73Oo.7GGLXylrKaRmLoSxrH2euQp50hrsQCpFuCaeZ%2F37lto",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch screenshots");
      }
      return response.json();
    })
    .then((data) => {
      if (data.items && data.items.length > 0) {
        const imageArr = data.items.map((val) => {
          return {
            url: val.snapShot.url,
            title: val.createdAt,
          };
        });
        showImages(imageArr);
      } else {
        statusMessage.textContent = "No Screenshot found";
        document.getElementById("image-container").innerHTML = "";
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      statusMessage.textContent =
        "Failed to fetch screenshots. Please try again.";
    })
    .finally(() => showLoadingState(false));
}

document.getElementById("find-button").onclick = () => {
  const fromDate = document.getElementById("from").value;
  const toDate = document.getElementById("to").value;

  const statusMessage = document.getElementById("status-message");
  statusMessage.textContent = "";

  if (fromDate && toDate && new Date(toDate) < new Date(fromDate)) {
    statusMessage.textContent = '"To" date cannot be earlier than "From" date.';
    statusMessage.style.color = "red";
    return;
  }

  const fromTimestamp = fromDate
    ? new Date(fromDate).toLocaleDateString("en-CA")
    : null;
  const toTimestamp = toDate
    ? new Date(toDate).toLocaleDateString("en-CA")
    : null;

  fetchScreenShots(fromTimestamp, toTimestamp);
};

fetchScreenShots();
