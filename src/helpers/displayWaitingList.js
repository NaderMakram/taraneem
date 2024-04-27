function truncate(str, max_length) {
  return str.length > max_length ? str.slice(0, max_length - 1) + "…" : str;
}
export function displayWaitingList(waiting) {
  console.log(waiting);
  localStorage.setItem("waiting", JSON.stringify(waiting))
  let htmlData = waiting
    .map((element) => {
      // Extract information from the object
      let { item, refIndex } = element;
      let { title, chorus, verses, chapter_name } = item;

      let type = chapter_name ? "chapter" : "song";
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
        ? `<div class="verses">1- ${verses[0] && typeof verses[0][0] == "string"
          ? truncate(verses[0][0], 50)
          : ""
        }</div>`
        : "";

      // Combine everything into a single HTML block
      return `
      <div class="big ${type}" data-ref="${refIndex}">
        ${titleHTML}
        <h3>
        ${chapter_name ? chapter_name : ""}
        </h3>
        ${chapter_name ? verses[1] : ""}
        
        ${chapter_name ? "" : chorusHTML + versesHTML}
        <img src="./img/minus-64.png" class="delete hide" alt="delete"/>
        </div>
    `;
    })
    .join("");

  waiting_output.innerHTML = htmlData;
}
