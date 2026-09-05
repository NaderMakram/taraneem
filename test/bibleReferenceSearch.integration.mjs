import { initSearchEngine, searchAndDisplayResults } from "../src/helpers/searchService.js";

export async function run(chapters) {
  Object.assign(window.myCustomAPI, {
    getSongs: () => [],
    getBibleVerses: () => [],
    getBibleDBIndexed: () => chapters,
  });
  await initSearchEngine();
  const input = document.getElementById("title-input");
  const output = document.getElementById("search_output");
  let checks = 0;
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
    checks++;
  };
  function search(query) {
    input.value = query;
    searchAndDisplayResults(query);
    return window.res;
  }
  const cases = [
    ["رؤيا 3", "Rev 3", null],
    ["رؤيا 3 20", "Rev 3", "20"],
    ["رؤيا يوحنا ٣ ٢٠", "Rev 3", "20"],
    ["رؤيا ۳ ۲۰", "Rev 3", "20"],
    ["رؤيا ٣:٢٠", "Rev 3", "20"],
    ["رؤي 3", "Rev 3", null],
    ["رؤ 3 20", "Rev 3", "20"],
    ["صموئيل 3", "1Sam 3", null],
    ["صموئيل 3", "2Sam 3", null],
    ["صموئيل 3 4", "1Sam 3", "4"],
    ["صموئيل 3 4", "2Sam 3", "4"],
    ["صموئي 3", "1Sam 3", null],
    ["صمو 3", "1Sam 3", null],
    ["1 صموئيل 3 4", "1Sam 3", "4"],
    ["٢ صموئيل ٣ ٤", "2Sam 3", "4"],
    ["صموئيل 1 3 4", "1Sam 3", "4"],
    ["صموئيل ٢ ٣ ٤", "2Sam 3", "4"],
    ["صموئيل الأول 3 4", "1Sam 3", "4"],
    ["صموئيل الثاني 3", "2Sam 3", null],
    ["1صم 3 4", "1Sam 3", "4"],
    ["يوئيل 2 1", "Joel 2", "1"],
  ];
  for (const [query, chapterName, verse] of cases) {
    const result = search(query).find(item => item.chapter_en === chapterName && item.verse === verse);
    assert(result, "Reference resolves: " + query + " -> " + chapterName);
    assert(Array.from(output.querySelectorAll(".chapter")).some(item => item.dataset.ref === result.custom_ref), "Reference renders in search results: " + query);
  }
  for (const chapter of chapters.filter(item => item.chapter_number === 1)) {
    const query = chapter.chapter_book + " 1 1";
    assert(search(query).some(item => item.chapter_en === chapter.chapter_en && item.verse === "1"), "Every full book name resolves: " + query);
  }
  assert(search("رؤيا 23").length === 0, "Invalid Revelation chapter is rejected");
  assert(search("رؤيا 3 99").length === 0, "Invalid Revelation verse is rejected");
  assert(!search("2 صموئيل 3 4").some(item => item.chapter_en.startsWith("1Sam")), "Numbered Samuel reference stays in the selected book");
  input.value = "";
  output.replaceChildren();
  return checks + " Bible reference search assertions passed.";
}
