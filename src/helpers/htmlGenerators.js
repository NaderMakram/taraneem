function truncate(str, max_length) {
  return str.length > max_length ? str.slice(0, max_length - 1) + "…" : str;
}

export function generateHTML(dataArray, truncateLimit = 50) {
  // Ensure the input is an array
  if (!Array.isArray(dataArray)) {
    console.error("Input must be an array.");
    return "";
  }

  // Limit the results to the first 10 elements
  let trimmedResults = dataArray.slice(0, 10);

  // Generate HTML for each element
  let htmlData = trimmedResults
    .map((element) => {
      // Extract information from the object
      let { item, refIndex } = element;
      let { title, chorus, verses } = item;

      // Generate HTML for title
      let titleHTML = title ? `<h2>${title}</h2>` : "";

      // Generate HTML for chorus if it exists
      let chorusHTML = chorus
        ? `<div class="chorus">(ق) ${truncate(
            chorus.map((line) => `${line}`).join(""),
            50
          )}</div>`
        : "";

      // Generate HTML for verses if they exist
      let versesHTML = verses
        ? `<div class="verses">1- ${
            verses[0] && typeof verses[0][0] == "string"
              ? truncate(verses[0][0], truncateLimit)
              : ""
          }</div>`
        : "";

      // Combine everything into a single HTML block
      return `
        <div class="big song" data-ref="${refIndex}">
          ${titleHTML}
          ${chorusHTML}
          ${versesHTML}
          <img src="./img/plus.svg" class="plus hide" alt="plus"/>
        </div>
      `;
    })
    .join("");

  return htmlData;
}

export function generateBibleHTML(dataArray, term, truncateLimit = 50) {
  // Ensure the input is an array
  if (!Array.isArray(dataArray)) {
    console.error("Input must be an array.");
    console.log(dataArray);
    console.log(term);
    return "";
  }

  // Limit the results to the first 10 elements
  // let trimmedResults = dataArray.slice(0, 100);

  // Generate HTML for each element
  // let containsDigit = /\d/.test(term);

  let htmlData = dataArray
    .filter(function (element) {
      let { item } = element;
      let { chapter_number } = item;
      let searched_numbers = term.match(/\d+$/);
      let numbers = searched_numbers ? searched_numbers.map(Number) : 0;
      // console.log(searched_numbers)
      if (searched_numbers) {
        if (searched_numbers[0] == "0") {
          return true;
        } else if (
          !searched_numbers[0] ||
          chapter_number != searched_numbers[0]
        ) {
          return false; // skip
        }
      }
      return true;
    })
    .map((element) => {
      let { item, refIndex, score } = element;
      let { chapter_name, chapter_number, verses } = item;

      let titleHTML = chapter_name ? `<h2>${chapter_name}</h2>` : "";

      let versesHTML = verses
        ? `<div class="verses">1- ${
            verses["1"] + "2- " + verses["2"] + " ..."
          }</div>`
        : "";

      return `
        <div class="big chapter" data-ref="${refIndex}" dir="rtl">
          ${titleHTML}
          ${versesHTML}
          <img src="./img/plus.svg" class="plus hide" alt="plus"/>
        </div>
      `;
    })
    .join("");

  return htmlData;
}
