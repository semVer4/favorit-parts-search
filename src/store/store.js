import { configureStore } from "@reduxjs/toolkit";
import searchReducer from "./searchSlice.js";

export function createStore(preloadedState) {
  return configureStore({
    reducer: { search: searchReducer },
    preloadedState,
  });
}
