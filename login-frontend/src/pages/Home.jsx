import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  ArrowRightIcon,
  BuildingOfficeIcon,
  UsersIcon,
  CalendarIcon,
  CreditCardIcon,
  CheckCircleIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { Button } from "../components/ui/button";

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [hostelLogos, setHostelLogos] = useState([]);
  const [carouselImages, setCarouselImages] = useState([]);

  // Fetch hostels from database
  useEffect(() => {
    const fetchHostels = async () => {
      try {
        const apiBase =
          import.meta.env.VITE_SERVER_URL || "http://localhost:3000/api";
        const response = await fetch(`${apiBase}/hostel/all`);

        if (response.ok) {
          const hostels = await response.json();
          if (Array.isArray(hostels)) {
            // Map hostel names to logo paths
            const logos = hostels
              .map((hostel) => ({
                name: hostel.hostel_name || hostel.name,
                logo: `/hostel-logos/${(hostel.hostel_name || hostel.name).replace(/\s+/g, "")}.png`,
              }))
              .filter((hostel) => hostel.name); // Filter out any invalid entries

            setHostelLogos(logos);

            // Map hostel names to carousel images (hostel photos)
            const carouselImgs = hostels
              .map((hostel) => {
                const hostelName = (hostel.hostel_name || hostel.name)
                  .toLowerCase()
                  .replace(/\s+/g, "");
                // Map hostel names to image file names
                const imageMap = {
                  barak: "barak.jpg",
                  brahmaputra: "brahmaputra.jpg",
                  dhansiri: "dhansiri.jpg",
                  dihing: "dihing.jpg",
                  disang: "disang.jpg",
                  gaurang: "gaurang_.jpg",
                  kapili: "kapili_.jpg",
                  lohit: "lohit.jpg",
                  manas: "manas.jpg",
                  siang: "siang.jpg",
                  subansiri: "subhansiri.jpg",
                  umaim: "umiam.jpg",
                  kameng: "kameng.jpg",
                };
                const imageFile = imageMap[hostelName] || `${hostelName}.jpg`;
                return {
                  src: `/Hostel Images/${imageFile}`,
                  alt: `${hostel.hostel_name || hostel.name} Hostel`,
                };
              })
              .filter((img) => img.src); // Filter out any invalid entries

            setCarouselImages(
              carouselImgs.length > 0
                ? carouselImgs
                : [
                    { src: "/Hostel Images/barak.jpg", alt: "Barak Hostel" },
                    {
                      src: "/Hostel Images/brahmaputra.jpg",
                      alt: "Brahmaputra Hostel",
                    },
                    {
                      src: "/Hostel Images/dhansiri.jpg",
                      alt: "Dhansiri Hostel",
                    },
                  ],
            );
          }
        }
      } catch (error) {
        console.error("Error fetching hostels:", error);
        // Fallback to default hostels if API fails
        setHostelLogos([
          { name: "Barak", logo: "/hostel-logos/Barak.png" },
          { name: "Brahmaputra", logo: "/hostel-logos/Brahmaputra.png" },
          { name: "Dhansiri", logo: "/hostel-logos/Dhansiri.png" },
          { name: "Dihing", logo: "/hostel-logos/Dihing.png" },
          { name: "Disang", logo: "/hostel-logos/Disang.png" },
          { name: "Gaurang", logo: "/hostel-logos/Gaurang.png" },
          { name: "Kapili", logo: "/hostel-logos/Kapili.png" },
          { name: "Lohit", logo: "/hostel-logos/Lohit.png" },
          { name: "Manas", logo: "/hostel-logos/Manas.png" },
          { name: "Siang", logo: "/hostel-logos/Siang.png" },
          { name: "Subansiri", logo: "/hostel-logos/Subansiri.png" },
          { name: "Umaim", logo: "/hostel-logos/Umaim.png" },
        ]);
        // Fallback carousel images
        setCarouselImages([
          { src: "/Hostel Images/barak.jpg", alt: "Barak Hostel" },
          { src: "/Hostel Images/brahmaputra.jpg", alt: "Brahmaputra Hostel" },
          { src: "/Hostel Images/dhansiri.jpg", alt: "Dhansiri Hostel" },
        ]);
      }
    };

    fetchHostels();
  }, []);

  // Auto-play carousel
  useEffect(() => {
    if (carouselImages.length === 0) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    }, 5000); // Change slide every 5 seconds (slower transition)

    return () => clearInterval(interval);
  }, [carouselImages.length]);

  // Contributors to HABit
  const contributors = [
    {
      icon: BuildingOfficeIcon,
      title: "Hostel Affairs Board",
      description:
        "Overseeing hostel affairs, managing policies, and coordinating with different hostels across campus.",
    },
    {
      icon: UsersIcon,
      title: "Hostel Management Committees",
      description:
        "Managing day-to-day operations, student welfare, and ensuring smooth hostel functioning.",
    },
    {
      icon: BuildingOfficeIcon,
      title: "Hostel Administrators",
      description:
        "Handling administrative tasks, student records, and operational management efficiently.",
    },
  ];

  // Statistics state
  const [liveStats, setLiveStats] = useState({
    students: "12,000+",
    hostels: hostelLogos.length.toString() || "12",
    mealsServed: "0",
    complaintsResolved: "0",
  });

  // Update hostel count when hostelLogos changes
  useEffect(() => {
    if (hostelLogos.length > 0) {
      setLiveStats((prev) => ({
        ...prev,
        hostels: hostelLogos.length.toString(),
      }));
    }
  }, [hostelLogos]);

  // Fetch live statistics from database
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const apiBase =
          import.meta.env.VITE_SERVER_URL || "http://localhost:3000/api";

        // Fetch total scan logs count (all time)
        try {
          const scanLogsResponse = await fetch(`${apiBase}/logs/total`);
          if (scanLogsResponse.ok) {
            const scanLogsData = await scanLogsResponse.json();
            const totalScanLogs = scanLogsData.total || 0;
            setLiveStats((prev) => ({
              ...prev,
              mealsServed: totalScanLogs.toLocaleString(),
            }));
          }
        } catch (scanLogsError) {
          console.error("Error fetching total scan logs count:", scanLogsError);
        }

        // Fetch user count (students)
        try {
          const userResponse = await fetch(`${apiBase}/users/count`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (userResponse.ok) {
            const userData = await userResponse.json();
            if (typeof userData?.count === "number") {
              const studentCount = userData.count;
              setLiveStats((prev) => ({
                ...prev,
                students: studentCount.toLocaleString(),
              }));
            } else {
              console.warn("User count payload is invalid:", userData);
            }
          } else {
            console.error(
              "Failed to fetch user count:",
              userResponse.status,
              userResponse.statusText,
            );
          }
        } catch (userError) {
          console.error("Error fetching user count:", userError);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
        // Keep default values on error
      }
    };

    fetchStats();
    // Refresh stats every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Statistics
  const stats = [
    { icon: UsersIcon, value: liveStats.students, label: "Students" },
    { icon: BuildingOfficeIcon, value: liveStats.hostels, label: "Hostels" },
    { icon: ChartBarIcon, value: liveStats.mealsServed, label: "Meals Served" },
    {
      icon: CheckCircleIcon,
      value: liveStats.complaintsResolved,
      label: "Complaints Resolved",
    },
  ];

  // Blog posts
  const blogPosts = [
    {
      title: "Streamlining Hostel Management at IIT Guwahati",
      description:
        "How HABit is transforming hostel administration and making student services more accessible.",
      image: "/api/placeholder/400/300",
    },
    {
      title: "Digital Transformation in Campus Living",
      description:
        "The impact of technology on student housing and accommodation services at IIT Guwahati.",
      image: "/api/placeholder/400/300",
    },
    {
      title: "Student Services Made Easy",
      description:
        "Simplifying access to forms, applications, and administrative processes for all students.",
      image: "/api/placeholder/400/300",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden h-screen min-h-[500px] max-h-[800px] sm:h-[70vh] sm:min-h-[600px]">
        {/* Carousel Background */}
        <div className="absolute inset-0 z-0">
          {carouselImages.map((image, index) => {
            const isActive = index === currentSlide;
            const isNext = index === (currentSlide + 1) % carouselImages.length;
            const isPrev =
              index ===
              (currentSlide - 1 + carouselImages.length) %
                carouselImages.length;

            return (
              <div
                key={index}
                className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
                  isActive
                    ? "opacity-100 blur-0"
                    : isNext || isPrev
                      ? "opacity-0 blur-md"
                      : "opacity-0 blur-sm"
                }`}
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = "none";
                    const fallback = e.target.nextElementSibling;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
                <div
                  className="hidden w-full h-full items-center justify-center text-center bg-gray-100"
                  style={{ display: "none" }}
                >
                  <BuildingOfficeIcon className="w-24 h-24 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">{image.alt}</p>
                </div>
              </div>
            );
          })}
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-black/50"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 h-full flex items-center px-4 sm:px-8 lg:px-16 xl:px-20 py-12 sm:py-20">
          <div className="max-w-7xl mx-auto w-full">
            <div className="max-w-3xl">
              {/* Text Content */}
              <div className="mb-10">
                <h1 className="text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                  Your Complete Hostel Experience,{" "}
                  <span
                    className="text-[#6149CD]"
                    style={{
                      WebkitTextStroke: "1.5px black",
                      textStroke: "1.5px black",
                      paintOrder: "stroke fill",
                    }}
                  >
                    Simplified
                  </span>
                </h1>
                <p className="text-xl text-white/95 mb-8">
                  Streamlining hostel management at IIT Guwahati with innovative
                  digital solutions for students and administrators.
                </p>
              </div>

              {/* App Store Buttons */}
              <div className="flex flex-wrap gap-4">
                <a
                  href="https://apps.apple.com/us/app/habit-iitg/id6740746036"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-3 px-4 sm:px-6 py-2.5 sm:py-3 bg-black/90 backdrop-blur-sm text-white rounded-xl hover:bg-black transition-all duration-200 shadow-lg hover:shadow-xl border border-white/20"
                >
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-.97.49-2.05.55-3.08-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-xs leading-tight">
                      Download on the
                    </span>
                    <span className="text-sm sm:text-lg font-semibold leading-tight">
                      App Store
                    </span>
                  </div>
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=in.codingclub.hab"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-3 px-4 sm:px-6 py-2.5 sm:py-3 bg-black/90 backdrop-blur-sm text-white rounded-xl hover:bg-black transition-all duration-200 shadow-lg hover:shadow-xl border border-white/20"
                >
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5Z"
                      fill="#00D9FF"
                    />
                    <path
                      d="M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12Z"
                      fill="#00F076"
                    />
                    <path
                      d="M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81Z"
                      fill="#FFCE00"
                    />
                    <path
                      d="M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"
                      fill="#FF3A44"
                    />
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-xs leading-tight">GET IT ON</span>
                    <span className="text-sm sm:text-lg font-semibold leading-tight">
                      Google Play
                    </span>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* Pagination dots - Bottom middle */}
          {carouselImages.length > 0 && (
            <div className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
              {carouselImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentSlide
                      ? "bg-[#6149CD] w-6"
                      : "bg-white/50 hover:bg-white/70"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Our Clients Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-8 sm:px-12 lg:px-16 xl:px-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              All Hostels at IIT Guwahati
            </h2>
            <p className="text-lg text-gray-600">
              Serving all {hostelLogos.length || 12} hostels with comprehensive
              management solutions
            </p>
          </div>
          <div className="overflow-hidden relative">
            <div className="marquee flex gap-6">
              {/* First set of logos */}
              {hostelLogos.map((hostel, index) => (
                <div
                  key={`first-${index}`}
                  className="shrink-0 flex items-center justify-center h-20 w-32 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-3"
                >
                  <img
                    src={hostel.logo}
                    alt={`${hostel.name} Hostel Logo`}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = "none";
                      const fallback = e.target.nextElementSibling;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                  <span
                    className="text-gray-700 font-medium text-xs hidden items-center justify-center"
                    style={{ display: "none" }}
                  >
                    {hostel.name}
                  </span>
                </div>
              ))}
              {/* Duplicate set for seamless loop */}
              {hostelLogos.map((hostel, index) => (
                <div
                  key={`second-${index}`}
                  className="shrink-0 flex items-center justify-center h-20 w-32 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-3"
                >
                  <img
                    src={hostel.logo}
                    alt={`${hostel.name} Hostel Logo`}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = "none";
                      const fallback = e.target.nextElementSibling;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                  <span
                    className="text-gray-700 font-medium text-xs hidden items-center justify-center"
                    style={{ display: "none" }}
                  >
                    {hostel.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Message from Anjan Kumar S */}
      <section className="py-20 px-8 sm:px-12 lg:px-16 xl:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-10 gap-12 items-center">
            <div className="lg:col-span-3 flex items-center justify-center">
              <div className="w-64 h-64 rounded-full overflow-hidden border-4 border-[#6149CD] shadow-lg">
                <img
                  src="/Anjan.jpeg"
                  alt="Anjan Kumar S"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = "none";
                    const fallback = e.target.nextElementSibling;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
                <div
                  className="hidden w-full h-full items-center justify-center bg-gray-200"
                  style={{ display: "none" }}
                >
                  <UsersIcon className="w-32 h-32 text-gray-400" />
                </div>
              </div>
            </div>
            <div className="lg:col-span-7">
              <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                "As the Admin of Hostel Affairs Board at IIT Guwahati, my love
                for our students drives everything I do. I wanted to make all
                the students' work easy and streamline their hostel experience.
                HABit represents our commitment to simplifying administrative
                processes and ensuring that every student can focus on what
                matters most - their education and growth. This platform is
                built with care, understanding, and a deep desire to serve our
                student community better."
              </p>
              <div className="mb-6">
                <div className="text-xl font-semibold text-[#6149CD] mb-1">
                  Anjan Kumar S
                </div>
                <div className="text-gray-600">
                  Admin, Hostel Affairs Board, IIT Guwahati
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Community Management Section */}
      <section className="py-20 px-8 sm:px-12 lg:px-16 xl:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              The Backbone of Hostel Management at IIT Guwahati
            </h2>
            <p className="text-lg text-gray-600">Who contribute to HABit</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {contributors.map((contributor, index) => {
              const Icon = contributor.icon;
              return (
                <div key={index} className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-6">
                    <Icon className="w-8 h-8 text-[#6149CD]" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    {contributor.title}
                  </h3>
                  <p className="text-gray-600">{contributor.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Message from Harshit Tomar */}
      <section className="py-20 bg-gray-50 px-8 sm:px-12 lg:px-16 xl:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-10 gap-12 items-center">
            <div className="lg:col-span-7 order-2 lg:order-0">
              <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                "As the General Secretary of Hostel Affairs Board, IIT Guwahati,
                my vision is to streamline everything using modern technology to
                provide faster and quicker service to the Hostel residents.
                HABit embodies this vision - leveraging cutting-edge digital
                solutions to transform how we manage hostel affairs. By
                embracing technology, we're not just modernizing processes;
                we're creating a more responsive, efficient, and
                student-friendly environment. This platform ensures that every
                hostel resident receives prompt, reliable service, making their
                campus life smoother and more enjoyable."
              </p>
              <div className="mb-6">
                <div className="text-xl font-semibold text-[#6149CD] mb-1">
                  Harshit Tomar
                </div>
                <div className="text-gray-600">
                  General Secretary, Hostel Affairs Board, IIT Guwahati
                </div>
              </div>
            </div>
            <div className="lg:col-span-3 flex items-center justify-center order-1 lg:order-0">
              <div className="w-64 h-64 rounded-full overflow-hidden border-4 border-[#6149CD] shadow-lg">
                <img
                  src="/Harshit.jpeg"
                  alt="Harshit Tomar"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = "none";
                    const fallback = e.target.nextElementSibling;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
                <div
                  className="hidden w-full h-full items-center justify-center bg-gray-200"
                  style={{ display: "none" }}
                >
                  <UsersIcon className="w-32 h-32 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-20 bg-gray-50 px-8 sm:px-12 lg:px-16 xl:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Our dedication has led to{" "}
                <span className="text-[#6149CD]">
                  transforming hostel management
                </span>
              </h2>
              <p className="text-lg text-gray-600">
                We reached here with our hard work and dedication
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="shrink-0">
                      <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-[#6149CD]" />
                      </div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-gray-900 mb-1">
                        {stat.value}
                      </div>
                      <div className="text-gray-600">{stat.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Message from Coding Club IIT Guwahati */}
      <section className="py-20 px-8 sm:px-12 lg:px-16 xl:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-10 gap-12 items-center">
            <div className="lg:col-span-3 flex items-center justify-center">
              <div className="w-64 h-64 rounded-full overflow-hidden border-4 border-[#6149CD] shadow-lg bg-white flex items-center justify-center p-8">
                <img
                  src="/Coding Club.jpg"
                  alt="Coding Club IIT Guwahati"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.style.display = "none";
                    const fallback = e.target.nextElementSibling;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
                <div
                  className="hidden w-full h-full items-center justify-center bg-gray-200"
                  style={{ display: "none" }}
                >
                  <BuildingOfficeIcon className="w-32 h-32 text-gray-400" />
                </div>
              </div>
            </div>
            <div className="lg:col-span-7">
              <p className="text-lg text-gray-700 mb-6 leading-relaxed">
                Coding Club IIT Guwahati is a student-led team of developers who
                developed HABit IITG. Our vision is to support student bodies in
                providing tech support so that they can provide their services
                in a better way to the Campus. We believe that technology should
                serve the community, and HABit is our contribution to making
                hostel management more efficient, transparent, and
                student-friendly. By collaborating with the Hostel Affairs Board
                and other student bodies, we're creating digital solutions that
                truly make a difference in campus life.
              </p>
              <div className="mb-6">
                <div className="text-xl font-semibold text-[#6149CD] mb-1">
                  Coding Club IIT Guwahati
                </div>
                <div className="text-gray-600">
                  Student-led Development Team
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <section className="py-20 bg-gray-50 px-8 sm:px-12 lg:px-16 xl:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Updates and Announcements
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Stay informed about the latest developments in hostel management,
              platform updates, and important announcements from the Hostel
              Affairs Board.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {blogPosts.map((post, index) => (
              <div
                key={index}
                className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-200"
              >
                <div className="w-full h-48 bg-gray-200 flex items-center justify-center border-b border-gray-200">
                  <BuildingOfficeIcon className="w-16 h-16 text-gray-400" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {post.title}
                  </h3>
                  <p className="text-gray-600 mb-4">{post.description}</p>
                  <Link
                    to="#"
                    className="text-green-600 font-semibold hover:text-green-700 flex items-center text-sm"
                  >
                    Read more
                    <ArrowRightIcon className="ml-2 w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
