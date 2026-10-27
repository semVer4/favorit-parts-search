import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { findBrands, findOffers } from "./api/partsApi.js";
import { createStore } from "./store/store.js";

vi.mock("./api/partsApi.js", () => ({
  findBrands: vi.fn(),
  findOffers: vi.fn(),
}));

const brands = [{ brand: "MEYLE", name: "Масляный фильтр" }];
const offers = [
  {
    id: "meyle-dmd",
    goodsId: "meyle",
    name: "Масляный фильтр",
    brand: "MEYLE",
    number: "01089",
    warehouse: "ДМД",
    price: 1200,
    stock: 2,
    isAnalogue: false,
  },
];

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderApp() {
  const store = createStore();
  render(
    <Provider store={store}>
      <App />
    </Provider>,
  );
  return store;
}

async function searchFor(user, number = "01089") {
  await user.type(screen.getByRole("textbox", { name: "Артикул" }), number);
  await user.click(screen.getByRole("button", { name: "Найти" }));
}

beforeEach(() => vi.resetAllMocks());

describe("подбор запчасти", () => {
  it("проходит оба этапа и загружает предложения только после выбора бренда", async () => {
    const user = userEvent.setup();
    const brandsResponse = deferred();
    const offersResponse = deferred();
    findBrands.mockReturnValue(brandsResponse.promise);
    findOffers.mockReturnValue(offersResponse.promise);
    renderApp();

    expect(screen.getByText("Какую деталь ищем?")).toBeInTheDocument();
    expect(findBrands).not.toHaveBeenCalled();
    await searchFor(user);
    expect(screen.getByRole("status")).toHaveTextContent("Ищем производителей");
    expect(findOffers).not.toHaveBeenCalled();

    await act(async () => {
      brandsResponse.resolve(brands);
    });
    await user.click(await screen.findByRole("button", { name: /MEYLE/ }));
    expect(findOffers).toHaveBeenCalledWith(
      "01089",
      "MEYLE",
      expect.any(AbortSignal),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Загружаем предложения и аналоги",
    );

    await act(async () => {
      offersResponse.resolve(offers);
    });
    expect(
      await screen.findByRole("table", { name: "Предложения по запчасти" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ДМД")).toBeInTheDocument();
    expect(screen.getByText("2 шт.")).toBeInTheDocument();
  });

  it("объясняет отсутствие результатов и не переходит ко второму этапу", async () => {
    const user = userEvent.setup();
    findBrands.mockResolvedValue([]);
    renderApp();
    await searchFor(user, "not-found");

    expect(
      await screen.findByText("По этому артикулу ничего не найдено"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Проверьте номер детали или попробуйте другой артикул."),
    ).toBeInTheDocument();
    expect(findOffers).not.toHaveBeenCalled();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("сохраняет выбранный бренд и предложения при повторном клике на тот же пример", async () => {
    const user = userEvent.setup();
    findBrands.mockResolvedValue(brands);
    findOffers.mockResolvedValue(offers);
    renderApp();
    await searchFor(user);
    await user.click(await screen.findByRole("button", { name: /MEYLE/ }));
    await screen.findByRole("table");

    await user.click(
      screen.getByRole("button", { name: "01089", exact: true }),
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /MEYLE/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(findBrands).toHaveBeenCalledTimes(1);
    expect(findOffers).toHaveBeenCalledTimes(1);
  });

  it("позволяет повторить неудачный запрос предложений без нового ввода", async () => {
    const user = userEvent.setup();
    findBrands.mockResolvedValue(brands);
    findOffers
      .mockRejectedValueOnce(new Error("Сервис временно недоступен"))
      .mockResolvedValueOnce(offers);
    renderApp();
    await searchFor(user);
    await user.click(await screen.findByRole("button", { name: /MEYLE/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Сервис временно недоступен",
    );
    await user.click(screen.getByRole("button", { name: "Повторить запрос" }));

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(findOffers).toHaveBeenCalledTimes(2);
    expect(findBrands).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("сбрасывает второй этап при смене артикула и игнорирует запоздавшие предложения", async () => {
    const user = userEvent.setup();
    const oldOffers = deferred();
    findBrands.mockResolvedValue(brands);
    findOffers.mockReturnValue(oldOffers.promise);
    const store = renderApp();
    await searchFor(user);
    await user.click(await screen.findByRole("button", { name: /MEYLE/ }));
    expect(
      screen.getByRole("heading", { name: "Предложения и аналоги" }),
    ).toBeInTheDocument();

    await user.clear(screen.getByRole("textbox", { name: "Артикул" }));
    await searchFor(user, "12345");
    await screen.findByRole("button", { name: /MEYLE/ });
    await act(async () => {
      oldOffers.resolve(offers);
    });

    expect(store.getState().search.number).toBe("12345");
    expect(store.getState().search.selectedBrand).toBe("");
    expect(
      screen.queryByRole("heading", { name: "Предложения и аналоги" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Очистить артикул" }));
    expect(screen.getByRole("textbox", { name: "Артикул" })).toHaveValue("");
    expect(screen.getByText("Какую деталь ищем?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Найти" })).toBeDisabled();
  });

  it("отправляет один запрос после паузы, а не запрос на каждый введённый символ", async () => {
    const user = userEvent.setup();
    findBrands.mockResolvedValue(brands);
    renderApp();
    await user.type(screen.getByRole("textbox", { name: "Артикул" }), "01089");

    expect(findBrands).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("button", { name: /MEYLE/ }),
    ).toBeInTheDocument();
    expect(findBrands).toHaveBeenCalledTimes(1);
    expect(findBrands).toHaveBeenCalledWith("01089", expect.any(AbortSignal));
  });
});
