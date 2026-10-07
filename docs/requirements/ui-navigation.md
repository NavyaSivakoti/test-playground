# Menus and in-page navigation (/ui/navigation)

**Purpose:** menus that open on click or hover, responsive navigation, anchors, redirects and deep links.

## User stories
- As a visitor, I can open Products by clicking, hover over a submenu (Laptops) and pick Ultrabooks.
- As a visitor, I can hover over Solutions to open a 3-column mega-menu, and hover over Resources for a dropdown.
- On a screen 768 px wide or less, I use "Open site menu" (hamburger).
- As a reader, I can use the "On this page" table of contents. The entry for the section at the top is highlighted (scroll-spy).
- As a visitor, I can follow a link to a missing page, a redirect chain and a deep link that pre-fills the search form.

## Acceptance criteria
- When I choose Products > Laptops > Ultrabooks, then state.lastMenu = "Products > Laptops > Ultrabooks".
- When I click "Configuration" in the table of contents, then the URL ends in #configuration and state.activeSection = "configuration".
- When I open ?q=laptop&sort=price, then "Search products" = "laptop", "Sort by" = Price and state.prefilled = {q:"laptop", sort:"price"}. Clicking "Search" sets state.search.
- "Start redirect chain" goes to ?from=a, which is then replaced by ?from=b (state.redirects = ["a","b"]).
- "Broken page link" opens /ui/does-not-exist, which shows "Page not found".

## Trap params
`variant=b` reorders the menu, renames Resources to "Learn" and renames the deep link. `bugs=brokenLink` makes Support lead to a 404. Also applies: `unstableIds`, `unstableClasses`. Section ids stay stable so the anchors keep working.
