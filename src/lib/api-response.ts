export type ApiSuccess<T> = {
  status: "success";
  message: string;
  data: T;
};

export type ApiFailure = {
  status: "error";
  message: string;
  error: { code: string };
};

export function success<T>(data: T, message = "Berhasil") {
  return Response.json({ status: "success", message, data } satisfies ApiSuccess<T>);
}

export function failure(code: string, message: string, status: number) {
  return Response.json(
    { status: "error", message, error: { code } } satisfies ApiFailure,
    { status },
  );
}
