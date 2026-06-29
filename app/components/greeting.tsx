"use client";

export default function Greeting() {
  const h = new Date().getHours();
  const text = h < 12 ? "Good morning 👋" : h < 17 ? "Good afternoon 👋" : "Good evening 👋";
  return <p className="text-white text-sm font-jakarta font-medium">{text}</p>;
}
