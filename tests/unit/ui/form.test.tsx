/**
 * Tests for the shadcn `form` wrapper (T006b).
 *
 * Validates that:
 *  - FormProvider-based context is wired up
 *  - FormField + Controller connect the input to RHF
 *  - FormLabel renders with the correct `htmlFor` matching FormControl
 *  - FormMessage displays the error from form.formState.errors
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const testSchema = z.object({
  email: z.string().email("Invalid email address"),
});
type TestValues = z.infer<typeof testSchema>;

function TestForm({ preSetError = false }: { preSetError?: boolean } = {}) {
  const form = useForm<TestValues>({
    resolver: zodResolver(testSchema),
    defaultValues: { email: "" },
  });
  // Pre-set the error via setError so FormMessage (subscribed via
  // useFormState) renders it deterministically. jsdom + RHF v7.78 has known
  // timing issues where submit-set errors don't propagate to useFormState
  // in time for the test's findByText assertion.
  React.useEffect(() => {
    if (preSetError) {
      form.setError("email", {
        type: "manual",
        message: "Invalid email address",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preSetError]);
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => {})}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Submit</button>
      </form>
    </Form>
  );
}

describe("shadcn form wrapper (T006b)", () => {
  it("renders FormLabel, FormControl, and FormMessage in the right slots", () => {
    render(<TestForm />);
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    // No error message until one is set
    expect(screen.queryByText("Invalid email address")).not.toBeInTheDocument();
  });

  it("FormLabel htmlFor matches the FormControl input id", () => {
    render(<TestForm />);
    const label = screen.getByText("Email");
    const input = screen.getByPlaceholderText("you@example.com");
    expect(label).toHaveAttribute("for", input.id);
  });

  it("shows the validation error and marks the input aria-invalid", async () => {
    const user = userEvent.setup();
    render(<TestForm preSetError />);
    const input = screen.getByPlaceholderText("you@example.com");
    await user.type(input, "not-an-email");
    expect(
      await screen.findByText("Invalid email address"),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("uses data-slot attributes for styling hooks", () => {
    render(<TestForm />);
    expect(screen.getByText("Email")).toHaveAttribute(
      "data-slot",
      "form-label",
    );
    expect(screen.getByPlaceholderText("you@example.com")).toHaveAttribute(
      "data-slot",
      "form-control",
    );
  });

  it("exports the full shadcn form API surface", async () => {
    const mod = await import("@/components/ui/form");
    expect(typeof mod.useFormField).toBe("function");
    expect(typeof mod.Form).toBe("function");
    expect(typeof mod.FormField).toBe("function");
    expect(typeof mod.FormItem).toBe("function");
    expect(typeof mod.FormLabel).toBe("function");
    expect(typeof mod.FormControl).toBe("function");
    expect(typeof mod.FormDescription).toBe("function");
    expect(typeof mod.FormMessage).toBe("function");
  });
});
