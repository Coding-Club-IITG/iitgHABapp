/**
 * `MenuItem.find({ _id: { $in: ids } })` does not preserve `Menu.items` order.
 * Maps hydrated docs back to the menu's id sequence for API / mobile clients.
 */
export function sortMenuItemsByMenuOrder(menuItemIdOrder, menuItemDocs) {
  if (!menuItemIdOrder?.length) return menuItemDocs || [];
  const byId = new Map(
    (menuItemDocs || []).map((d) => [d._id.toString(), d]),
  );
  return menuItemIdOrder
    .map((id) => byId.get(String(id)))
    .filter((doc) => doc != null);
}
