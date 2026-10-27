export default function BrandList({ brands, selectedBrand, onSelect }) {
  return (
    <div
      className="list-group brands-list"
      role="group"
      aria-label="Выбор производителя"
    >
      {brands.map(({ brand, name }) => {
        const selected = selectedBrand === brand;
        return (
          <button
            key={brand}
            type="button"
            className={`list-group-item list-group-item-action brand-option ${selected ? "active" : ""}`}
            aria-pressed={selected}
            onClick={() => onSelect(brand)}
          >
            <span className="brand-title">{brand}</span>
            <span className="brand-description">
              {name || "Запчасть с указанным артикулом"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
