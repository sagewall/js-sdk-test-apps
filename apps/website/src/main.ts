import "@esri/calcite-components/components/calcite-link";
import "@esri/calcite-components/components/calcite-navigation";
import "@esri/calcite-components/components/calcite-navigation-logo";
import "@esri/calcite-components/components/calcite-shell";
import "./style.css";

type App = {
  description: string;
  slug: string;
  title: string;
};

const apps = (import.meta.env.VITE_APPS as App[]).filter((app) => app.slug !== "website");
const root = document.querySelector<HTMLDivElement>("#app")!;

root.innerHTML = `
  <calcite-shell>
    <calcite-navigation slot="header" label="Main navigation">
      <calcite-navigation-logo
        slot="logo"
        heading="JS SDK Test Apps"
        heading-level="1"
        href="${import.meta.env.BASE_URL}"
        thumbnail="${import.meta.env.BASE_URL}favicon.svg"
      ></calcite-navigation-logo>
    </calcite-navigation>
    <main>
      <div class="section-heading">
        <h2>Applications</h2>
        <span>${apps.length} published</span>
      </div>
      <ul aria-label="Applications" id="applications"></ul>
      <p class="empty" ${apps.length ? "hidden" : ""}>No applications published yet.</p>
    </main>
  </calcite-shell>
`;

const list = document.querySelector<HTMLUListElement>("#applications")!;

for (const app of apps) {
  const description = document.createElement("p");
  const item = document.createElement("li");
  const link = document.createElement("calcite-link");

  description.textContent = app.description;
  link.href = `${import.meta.env.BASE_URL}${app.slug}/`;
  link.textContent = app.title;
  item.append(link);
  if (app.description) item.append(description);
  list.append(item);
}
