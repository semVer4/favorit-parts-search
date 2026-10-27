import { useMemo, useState } from "react";

const priceFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
});
const PAGE_SIZE = 25;

export default function OffersTable({ offers }) {
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState("default");
  const [page, setPage] = useState(1);

  const visibleOffers = useMemo(() => {
    const result = offers.filter((offer) => !inStockOnly || offer.stock > 0);
    if (sort === "price")
      result.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    else result.sort((a, b) => Number(a.isAnalogue) - Number(b.isAnalogue));
    return result;
  }, [offers, inStockOnly, sort]);
  const pageCount = Math.max(1, Math.ceil(visibleOffers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageOffers = visibleOffers.slice(startIndex, startIndex + PAGE_SIZE);

  function changeStockFilter(checked) {
    setInStockOnly(checked);
    setPage(1);
  }

  function changeSort(value) {
    setSort(value);
    setPage(1);
  }

  return (
    <div className="results-panel">
      <div className="results-toolbar">
        <span className="results-total">
          Предложений: <strong>{visibleOffers.length}</strong>
        </span>
        <div className="results-filters">
          <label className="form-check stock-filter">
            <input
              className="form-check-input"
              type="checkbox"
              checked={inStockOnly}
              onChange={(event) => changeStockFilter(event.target.checked)}
            />
            <span className="form-check-label">Только в наличии</span>
          </label>
          <label className="visually-hidden" htmlFor="sort">
            Сортировка предложений
          </label>
          <select
            id="sort"
            className="form-select form-select-sm sort-select"
            value={sort}
            onChange={(event) => changeSort(event.target.value)}
          >
            <option value="default">Сначала искомая деталь</option>
            <option value="price">Сначала дешевле</option>
          </select>
        </div>
      </div>

      {visibleOffers.length > 0 ? (
        <div className="table-responsive">
          <table
            className="table offers-table"
            aria-label="Предложения по запчасти"
          >
            <thead>
              <tr>
                <th scope="col">Деталь / производитель</th>
                <th scope="col">Склад / остаток</th>
                <th scope="col" className="price-column">
                  Цена
                </th>
              </tr>
            </thead>
            <tbody>
              {pageOffers.map((offer) => (
                <tr key={offer.id}>
                  <td>
                    <div className="offer-brand-line">
                      <span className="offer-brand">{offer.brand}</span>
                      <span className="offer-type">
                        {offer.isAnalogue ? "Аналог" : "Искомая деталь"}
                      </span>
                    </div>
                    <div className="offer-name">
                      {offer.name || "Без названия"}
                    </div>
                    <div className="offer-number">{offer.number}</div>
                  </td>
                  <td className="stock-cell">
                    <span className="stock-label">
                      {offer.stock > 0 ? `${offer.stock} шт.` : "Нет в наличии"}
                    </span>
                    {offer.warehouse && (
                      <span className="warehouse-name">{offer.warehouse}</span>
                    )}
                  </td>
                  <td className="price-cell">
                    {offer.price === null ? (
                      <span className="no-price" aria-label="Цена не указана">
                        —
                      </span>
                    ) : (
                      priceFormatter.format(offer.price)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="message-panel filtered-empty">
          <h3>Предложений в наличии нет</h3>
          <p>Снимите фильтр, чтобы увидеть все найденные позиции.</p>
          <button
            className="retry-button"
            type="button"
            onClick={() => changeStockFilter(false)}
          >
            Показать все предложения
          </button>
        </div>
      )}

      {pageCount > 1 && (
        <nav className="results-pagination" aria-label="Страницы предложений">
          <span className="pagination-summary">
            {startIndex + 1}–
            {Math.min(startIndex + PAGE_SIZE, visibleOffers.length)} из{" "}
            {visibleOffers.length}
          </span>
          <div className="pagination-controls">
            <button
              type="button"
              className="btn btn-sm page-button"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Назад
            </button>
            <span aria-live="polite">
              {currentPage} / {pageCount}
            </span>
            <button
              type="button"
              className="btn btn-sm page-button"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Далее
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
