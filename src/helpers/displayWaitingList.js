function truncate(str, max_length) {
  return str.length > max_length ? str.slice(0, max_length - 1) + "…" : str;
}
export function displayWaitingList(waiting) {
  // console.log("waiting");
  // console.log(waiting);
  localStorage.setItem("waiting_list", JSON.stringify(waiting));
  let htmlData = waiting
    .map(({ title, chorus, verse, verses, chapter_name, custom_ref }) => {
      // Extract information from the object
      // console.log(title, chorus, verse, verses, chapter_name, custom_ref);
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
        ? `<div class="verses">1- ${
            verses[0] && typeof verses[0][0] == "string"
              ? truncate(verses[0][0], 50)
              : ""
          }</div>`
        : "";

      // Combine everything into a single HTML block
      let chapter_first_two_verses;
      console.log(`custom_ref: ${custom_ref}`);
      if (!verse) {
        chapter_first_two_verses = truncate(
          `1) ${verses[1]} 2) ${verses[2]}`,
          50
        );
      }
      return `
      <div class="big ${type}" data-ref="${custom_ref}" ${
        verse ? `data-verse="${verse}"` : ""
      }>
      <span class="handle"></span>
      <div class="box-head">
      ${
        custom_ref.includes("song")
          ? '<img src="./img/song-icon.png" class="title-logo"/>'
          : '<img src="./img/bible-icon.png" class="title-logo"/>'
      }
      <h2>
      ${titleHTML}
        ${chapter_name ? chapter_name : ""}
        ${verse && chapter_name ? ":" : ""}
        ${verse && chapter_name ? verse : ""}
      </h2>
        </div>
        <div class="verses">
        ${verse && chapter_name ? verses[verse] : ""}
        ${custom_ref.includes("chapter") ? chapter_first_two_verses : ""}
        
        ${chapter_name ? "" : chorusHTML + versesHTML}
        </div>
        <img src="./img/minus-64.png" class="delete hide" alt="delete"/>
        </div>
    `;
    })
    .join("");

  waiting_output.innerHTML = htmlData;
}
