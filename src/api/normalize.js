function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function articleKey(value) {
  return text(value)
    .replace(/[\s./-]/g, "")
    .toLowerCase();
}

export function normalizeBrands(goods) {
  const brands = new Map();

  for (const item of goods) {
    const brand = text(item?.brand);
    if (!brand || brands.has(brand.toLowerCase())) continue;
    brands.set(brand.toLowerCase(), { brand, name: text(item.name) });
  }

  return [...brands.values()];
}

export function normalizeOffers(goods, number, brand) {
  const rows = new Map();
  const queue = goods.map((item) => ({ item, isAnalogue: false }));

  for (let index = 0; index < queue.length; index += 1) {
    const { item, isAnalogue } = queue[index];
    if (!item || typeof item !== "object") continue;

    if (Array.isArray(item.analogues)) {
      queue.push(
        ...item.analogues.map((analogue) => ({
          item: analogue,
          isAnalogue: true,
        })),
      );
    }

    const itemBrand = text(item.brand);
    const itemNumber = text(item.number);
    const goodsId = text(item.goodsID);
    if (!itemBrand || (!itemNumber && !text(item.name) && !goodsId)) continue;

    const itemKey =
      goodsId ||
      `${itemBrand.toLowerCase()}|${articleKey(itemNumber)}|${text(item.name)}`;
    const analogue =
      isAnalogue ||
      Boolean(brand && itemBrand.toLowerCase() !== text(brand).toLowerCase()) ||
      Boolean(
        number && itemNumber && articleKey(itemNumber) !== articleKey(number),
      );
    const warehouses = Array.isArray(item.warehouses)
      ? item.warehouses.filter(
          (warehouse) => warehouse && typeof warehouse === "object",
        )
      : [];
    const base = {
      goodsId,
      name: text(item.name) || "Без названия",
      brand: itemBrand,
      number: itemNumber,
      isAnalogue: analogue,
    };

    if (!warehouses.length) {
      const id = `${itemKey}|unavailable`;
      if (!rows.has(id))
        rows.set(id, { ...base, id, warehouse: "", price: null, stock: 0 });
      continue;
    }

    warehouses.forEach((warehouse, warehouseIndex) => {
      // Цена и остаток берутся из одного предложения, а не из общих полей товара.
      const price = numberOrNull(warehouse.price);
      const stock = Math.floor(numberOrNull(warehouse.stock) ?? 0);
      const warehouseKey =
        text(warehouse.id) ||
        text(warehouse.code) ||
        `warehouse-${warehouseIndex}`;
      const id = [
        itemKey,
        warehouseKey,
        text(warehouse.warehouseShipping),
        text(warehouse.shipmentDate),
        price,
        stock,
      ].join("|");

      if (!rows.has(id)) {
        rows.set(id, {
          ...base,
          id,
          warehouse: text(warehouse.code),
          price,
          stock,
        });
      }
    });
  }

  return [...rows.values()];
}
