import type { Metadata } from "next";

export const metadata: Metadata = { title: "Blog | RTRDA INTRANET" };

export default function IntranetBlogPage() {
  return (
    <div className="intranet-stub">
      <h1>Blog</h1>
      <p>
        สถาบันวิจัยและพัฒนาเทคโนโลยีระบบราง (องค์การมหาชน)
        <br />
        Rail Technology Research and Development Agency (Public Organization)
      </p>
    </div>
  );
}
