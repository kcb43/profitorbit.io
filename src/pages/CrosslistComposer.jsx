import React, { useMemo, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { useNavigate, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RichTextarea } from "@/components/ui/rich-textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  Rocket,
  ImagePlus,
  ImageIcon,
  X,
  RefreshCw,
  Save,
  Package,
  Palette,
  ArrowLeft,
  GripVertical,
  Sparkles,
  BarChart,
  ExternalLink,
  Lock,
  Unlock,
  Settings,
  Eye,
  DollarSign,
  Truck,
  Tag,
  Home,
} from "lucide-react";
import ColorPickerDialog from "../components/ColorPickerDialog";
import SoldLookupDialog from "../components/SoldLookupDialog";
import EbaySearchDialog from "../components/EbaySearchDialog";
import imageCompression from "browser-image-compression";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInventoryTags } from "@/hooks/useInventoryTags";
import { useEbayCategoryTreeId, useEbayCategories, useEbayCategoryAspects } from "@/hooks/useEbayCategorySuggestions";
import { TagInput } from "@/components/TagInput";
import { DescriptionGenerator } from "@/components/DescriptionGenerator";
import { getEbayItemUrl } from "@/utils/ebayHelpers";
import { ImageEditor } from "@/components/ImageEditor";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { createMarketplaceListing, getUserPages, isConnected } from "@/api/facebookClient";

const FACEBOOK_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg";
const MERCARI_ICON_URL = "https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B";
const EBAY_ICON_URL = "https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg";
const ETSY_ICON_URL = "https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B";
const POSHMARK_ICON_URL = "https://cdn.brandfetch.io/idUxsADOAW/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B";

// Predefined categories that should be cleared when loading items into crosslisting composer
// to allow users to select from eBay category picklist instead
const PREDEFINED_CATEGORIES = [
  "Antiques",
  "Books, Movies & Music",
  "Clothing & Apparel",
  "Collectibles",
  "Electronics",
  "Gym/Workout",
  "Health & Beauty",
  "Home & Garden",
  "Jewelry & Watches",
  "Kitchen",
  "Makeup",
  "Mic/Audio Equipment",
  "Motorcycle",
  "Motorcycle Accessories",
  "Pets",
  "Pool Equipment",
  "Shoes/Sneakers",
  "Sporting Goods",
  "Stereos & Speakers",
  "Tools",
  "Toys & Hobbies",
  "Yoga"
];

// Mercari Category Tree
const MERCARI_CATEGORIES = {
  "1": {
    id: "1",
    name: "Women",
    subcategories: {
      "11": {
        id: "11",
        name: "Dresses",
        subcategories: {
          "149": { id: "149", name: "Above knee, mini" },
          "150": { id: "150", name: "Knee-length" },
          "151": { id: "151", name: "Midi" },
          "152": { id: "152", name: "Maxi" },
          "153": { id: "153", name: "High Low" },
          "154": { id: "154", name: "Other" },
          "1866": { id: "1866", name: "Jumpsuits & Rompers" }
        }
      },
      "12": {
        id: "12",
        name: "Tops & blouses",
        subcategories: {
          "155": { id: "155", name: "Blouse" },
          "156": { id: "156", name: "Button down shirt" },
          "157": { id: "157", name: "Halter" },
          "158": { id: "158", name: "Knit top" },
          "159": { id: "159", name: "Polo shirt" },
          "161": { id: "161", name: "T-shirts" },
          "162": { id: "162", name: "Tunic" },
          "163": { id: "163", name: "Turtleneck" },
          "164": { id: "164", name: "Wrap" },
          "165": { id: "165", name: "Other" },
          "1955": { id: "1955", name: "Bodysuits" },
          "1956": { id: "1956", name: "Camisoles" },
          "1957": { id: "1957", name: "Tank Tops" }
        }
      },
      "13": {
        id: "13",
        name: "Sweaters",
        subcategories: {
          "166": { id: "166", name: "Cardigan" },
          "167": { id: "167", name: "Collared" },
          "168": { id: "168", name: "Cowl neck" },
          "169": { id: "169", name: "Crewneck" },
          "170": { id: "170", name: "Full zip" },
          "171": { id: "171", name: "Henley" },
          "172": { id: "172", name: "Hooded" },
          "173": { id: "173", name: "Poncho" },
          "174": { id: "174", name: "Scoop neck" },
          "175": { id: "175", name: "Shrug" },
          "176": { id: "176", name: "Sweatercoat" },
          "177": { id: "177", name: "Tunic" },
          "180": { id: "180", name: "V-neck" },
          "181": { id: "181", name: "Wrap" },
          "182": { id: "182", name: "Other" },
          "1958": { id: "1958", name: "Mock Sweaters" },
          "1959": { id: "1959", name: "Turtleneck Sweaters" },
          "1960": { id: "1960", name: "Sleeveless Sweaters" },
          "1961": { id: "1961", name: "Sweater Vests" }
        }
      },
      "14": {
        id: "14",
        name: "Jeans",
        subcategories: {
          "183": { id: "183", name: "Boot cut" },
          "184": { id: "184", name: "Boyfriend" },
          "186": { id: "186", name: "Cargo" },
          "187": { id: "187", name: "Flare" },
          "188": { id: "188", name: "Leggings" },
          "189": { id: "189", name: "Overalls" },
          "190": { id: "190", name: "Relaxed" },
          "192": { id: "192", name: "Straight leg" },
          "193": { id: "193", name: "Wide leg" },
          "194": { id: "194", name: "Other" },
          "1962": { id: "1962", name: "Capri Jeans" },
          "1963": { id: "1963", name: "Cropped Jeans" },
          "1964": { id: "1964", name: "Skinny Jeans" },
          "1965": { id: "1965", name: "Slim Jeans" }
        }
      },
      "15": {
        id: "15",
        name: "Pants",
        subcategories: {
          "196": { id: "196", name: "Cargo" },
          "197": { id: "197", name: "Casual pants" },
          "198": { id: "198", name: "Corduroys" },
          "199": { id: "199", name: "Dress pants" },
          "200": { id: "200", name: "Khakis, chinos" },
          "201": { id: "201", name: "Leather" },
          "202": { id: "202", name: "Linen" },
          "203": { id: "203", name: "Other" },
          "1966": { id: "1966", name: "Capri Pants" },
          "1967": { id: "1967", name: "Cropped Pants" }
        }
      },
      "16": {
        id: "16",
        name: "Skirts",
        subcategories: {
          "204": { id: "204", name: "A-line" },
          "205": { id: "205", name: "Asymmetrical" },
          "206": { id: "206", name: "Bubble" },
          "207": { id: "207", name: "Full skirt" },
          "208": { id: "208", name: "Maxi" },
          "209": { id: "209", name: "Mini" },
          "210": { id: "210", name: "Peasant" },
          "211": { id: "211", name: "Pleated" },
          "212": { id: "212", name: "Straight, pencil" },
          "213": { id: "213", name: "Tiered" },
          "214": { id: "214", name: "Wrap" },
          "215": { id: "215", name: "Other" }
        }
      },
      "17": {
        id: "17",
        name: "Coats & jackets",
        subcategories: {
          "216": { id: "216", name: "Cape" },
          "217": { id: "217", name: "Fleece jacket" },
          "218": { id: "218", name: "Jean jacket" },
          "219": { id: "219", name: "Military" },
          "220": { id: "220", name: "Motorcycle" },
          "221": { id: "221", name: "Parka" },
          "222": { id: "222", name: "Peacoat" },
          "223": { id: "223", name: "Poncho" },
          "224": { id: "224", name: "Puffer" },
          "225": { id: "225", name: "Raincoat" },
          "226": { id: "226", name: "Trench" },
          "227": { id: "227", name: "Vest" },
          "228": { id: "228", name: "Windbreaker" },
          "229": { id: "229", name: "Wool" },
          "230": { id: "230", name: "Other" }
        }
      },
      "18": {
        id: "18",
        name: "Suits & blazers",
        subcategories: {
          "231": { id: "231", name: "Blazer" },
          "232": { id: "232", name: "Dress suit" },
          "233": { id: "233", name: "Pant suit" },
          "234": { id: "234", name: "Skirt suit" },
          "235": { id: "235", name: "Other" }
        }
      },
      "19": {
        id: "19",
        name: "Athletic apparel",
        subcategories: {
          "236": { id: "236", name: "Jackets" },
          "237": { id: "237", name: "Jerseys" },
          "240": { id: "240", name: "Shorts" },
          "243": { id: "243", name: "Socks" },
          "244": { id: "244", name: "Sports bras" },
          "246": { id: "246", name: "Vests" },
          "247": { id: "247", name: "Other" },
          "1968": { id: "1968", name: "Athletic Leggings" },
          "1969": { id: "1969", name: "Athletic Pants" },
          "1970": { id: "1970", name: "Athletic Tights" },
          "1971": { id: "1971", name: "Athletic Polos" },
          "1972": { id: "1972", name: "Athletic T-Shirts" },
          "1973": { id: "1973", name: "Athletic Tank Tops" },
          "1974": { id: "1974", name: "Athletic Dresses" },
          "1975": { id: "1975", name: "Athletic Skirts" },
          "1976": { id: "1976", name: "Athletic Skorts" },
          "1977": { id: "1977", name: "Snow Bibs" },
          "1978": { id: "1978", name: "Snow Pants" },
          "1979": { id: "1979", name: "Snowsuits" },
          "1980": { id: "1980", name: "Athletic Hoodies" },
          "1981": { id: "1981", name: "Athletic Sweat Pants" },
          "1982": { id: "1982", name: "Athletic Sweatshirts" },
          "1983": { id: "1983", name: "Athletic Sweatsuits" },
          "1984": { id: "1984", name: "Track Jackets" },
          "1985": { id: "1985", name: "Track Pants" },
          "1986": { id: "1986", name: "Tracksuits" }
        }
      },
      "20": {
        id: "20",
        name: "Swimwear",
        subcategories: {
          "248": { id: "248", name: "One-piece" },
          "249": { id: "249", name: "Two-piece" },
          "250": { id: "250", name: "Cover-ups" },
          "251": { id: "251", name: "Beach accessories" }
        }
      },
      "21": {
        id: "21",
        name: "Women's handbags",
        subcategories: {
          "252": { id: "252", name: "Shoulder Bags" },
          "253": { id: "253", name: "Tote Bags" },
          "254": { id: "254", name: "Crossbody Bags" },
          "255": { id: "255", name: "Satchel" },
          "256": { id: "256", name: "Hobo Bags" },
          "258": { id: "258", name: "Backpacks" },
          "259": { id: "259", name: "Cosmetic bags" },
          "260": { id: "260", name: "Other" },
          "1863": { id: "1863", name: "Waist Bags & Fanny Packs" },
          "1864": { id: "1864", name: "Messenger Bags" },
          "1865": { id: "1865", name: "Bucket Bags" }
        }
      },
      "22": {
        id: "22",
        name: "Women's accessories",
        subcategories: {
          "261": { id: "261", name: "Sunglasses" },
          "262": { id: "262", name: "Wallets" },
          "264": { id: "264", name: "Belts" },
          "265": { id: "265", name: "Hats" },
          "266": { id: "266", name: "Hair accessories" },
          "267": { id: "267", name: "Watches" },
          "268": { id: "268", name: "Other" },
          "1987": { id: "1987", name: "Scarves" },
          "1988": { id: "1988", name: "Wraps" },
          "2624": { id: "2624", name: "Bandanas" },
          "2625": { id: "2625", name: "Fascinators" },
          "2626": { id: "2626", name: "Fashion Gloves" },
          "2627": { id: "2627", name: "Headbands" },
          "2628": { id: "2628", name: "Hijabs" },
          "2629": { id: "2629", name: "Umbrellas" },
          "3169": { id: "3169", name: "Cardholders" }
        }
      },
      "23": {
        id: "23",
        name: "Jewelry",
        subcategories: {
          "269": { id: "269", name: "Rings" },
          "270": { id: "270", name: "Necklaces" },
          "271": { id: "271", name: "Earrings" },
          "272": { id: "272", name: "Bracelets" },
          "2622": { id: "2622", name: "Nose Rings" },
          "2623": { id: "2623", name: "Toe Rings" },
          "3168": { id: "3168", name: "Pins" }
        }
      },
      "24": {
        id: "24",
        name: "Maternity",
        subcategories: {
          "273": { id: "273", name: "Dresses" },
          "275": { id: "275", name: "Sweaters" },
          "276": { id: "276", name: "Jeans" },
          "277": { id: "277", name: "Pants" },
          "278": { id: "278", name: "Skirts" },
          "279": { id: "279", name: "Coats & jackets" },
          "281": { id: "281", name: "Athletic apparel" },
          "282": { id: "282", name: "Other" },
          "1989": { id: "1989", name: "Maternity Blouses" },
          "1990": { id: "1990", name: "Maternity Button-Ups" },
          "1991": { id: "1991", name: "Maternity Camisoles" },
          "1992": { id: "1992", name: "Maternity Polos" },
          "1993": { id: "1993", name: "Maternity T-Shirts" },
          "1994": { id: "1994", name: "Maternity Tank Tops" },
          "1995": { id: "1995", name: "Maternity Blazers" },
          "1996": { id: "1996", name: "Maternity Suit Jackets" },
          "1997": { id: "1997", name: "Maternity Suit Pants" },
          "1998": { id: "1998", name: "Maternity Suits" },
          "1999": { id: "1999", name: "Maternity Suit Skirts" },
          "2000": { id: "2000", name: "Maternity Suit Vests" }
        }
      },
      "25": {
        id: "25",
        name: "Shoes",
        subcategories: {
          "283": { id: "283", name: "Athletic" },
          "284": { id: "284", name: "Boots" },
          "285": { id: "285", name: "Fashion sneakers" },
          "286": { id: "286", name: "Flats" },
          "289": { id: "289", name: "Outdoor" },
          "290": { id: "290", name: "Oxfords" },
          "291": { id: "291", name: "Heels" },
          "292": { id: "292", name: "Sandals" },
          "293": { id: "293", name: "Slippers" },
          "294": { id: "294", name: "Work & safety" },
          "295": { id: "295", name: "Other" },
          "2001": { id: "2001", name: "Loafers" },
          "2002": { id: "2002", name: "Slip-Ons" },
          "2003": { id: "2003", name: "Clogs" },
          "2004": { id: "2004", name: "Mules" }
        }
      },
      "26": { id: "26", name: "Other" },
      "1561": {
        id: "1561",
        name: "Underwear",
        subcategories: {
          "1562": { id: "1562", name: "G-strings & thongs" },
          "1563": { id: "1563", name: "Panties" },
          "1564": { id: "1564", name: "Thermal underwear" },
          "1565": { id: "1565", name: "Bras" },
          "1566": { id: "1566", name: "Other" }
        }
      },
      "1936": {
        id: "1936",
        name: "Shorts",
        subcategories: {
          "1937": { id: "1937", name: "Bermuda" },
          "1938": { id: "1938", name: "Bike" },
          "1939": { id: "1939", name: "Cargo" },
          "1940": { id: "1940", name: "Chino & khaki" },
          "1941": { id: "1941", name: "Denim" },
          "1942": { id: "1942", name: "High-waisted" },
          "1943": { id: "1943", name: "Pull-on" },
          "1944": { id: "1944", name: "Short shorts" },
          "1945": { id: "1945", name: "Skort" },
          "1946": { id: "1946", name: "Other" }
        }
      },
      "1947": {
        id: "1947",
        name: "Sleepwear & robes",
        subcategories: {
          "1948": { id: "1948", name: "Nightgowns & sleep shirts" },
          "1949": { id: "1949", name: "Pajama pants" },
          "1950": { id: "1950", name: "Pajama sets" },
          "1951": { id: "1951", name: "Pajama shorts" },
          "1952": { id: "1952", name: "Pajama tops" },
          "1953": { id: "1953", name: "Robes" },
          "1954": { id: "1954", name: "Other" }
        }
      }
    }
  },
  "2": {
    id: "2",
    name: "Men",
    subcategories: {
      "27": {
        id: "27",
        name: "Tops",
        subcategories: {
          "297": { id: "297", name: "Button-front" },
          "298": { id: "298", name: "Dress shirts" },
          "299": { id: "299", name: "Hawaiian" },
          "300": { id: "300", name: "Henley" },
          "302": { id: "302", name: "Tank" },
          "303": { id: "303", name: "T-shirts" },
          "304": { id: "304", name: "Turtleneck" },
          "305": { id: "305", name: "Other" },
          "2005": { id: "2005", name: "Polos" },
          "2006": { id: "2006", name: "Rugby Shirts" }
        }
      },
      "28": {
        id: "28",
        name: "Sweats & hoodies",
        subcategories: {
          "306": { id: "306", name: "Hoodie" },
          "307": { id: "307", name: "Sweatshirt, pullover" },
          "308": { id: "308", name: "Sweat Pants" },
          "309": { id: "309", name: "Sweatsuits" },
          "310": { id: "310", name: "Track jacket" },
          "311": { id: "311", name: "Other" }
        }
      },
      "29": {
        id: "29",
        name: "Sweaters",
        subcategories: {
          "312": { id: "312", name: "Cardigan" },
          "313": { id: "313", name: "Crewneck" },
          "314": { id: "314", name: "Full zip" },
          "315": { id: "315", name: "Polo" },
          "316": { id: "316", name: "Turtleneck" },
          "317": { id: "317", name: "Vest" },
          "318": { id: "318", name: "V-neck" },
          "319": { id: "319", name: "Other" }
        }
      },
      "30": {
        id: "30",
        name: "Jeans",
        subcategories: {
          "320": { id: "320", name: "Baggy, loose" },
          "321": { id: "321", name: "Boot cut" },
          "322": { id: "322", name: "Cargo" },
          "323": { id: "323", name: "Carpenter" },
          "324": { id: "324", name: "Classic, straight leg" },
          "325": { id: "325", name: "Overalls" },
          "326": { id: "326", name: "Relaxed" },
          "328": { id: "328", name: "Other" },
          "2007": { id: "2007", name: "Skinny Jeans" },
          "2008": { id: "2008", name: "Slim Jeans" }
        }
      },
      "31": {
        id: "31",
        name: "Pants",
        subcategories: {
          "329": { id: "329", name: "Cargo" },
          "330": { id: "330", name: "Carpenter" },
          "331": { id: "331", name: "Casual pants" },
          "332": { id: "332", name: "Corduroys" },
          "333": { id: "333", name: "Dress - flat front" },
          "334": { id: "334", name: "Dress - pleat" },
          "335": { id: "335", name: "Khakis, chinos" },
          "336": { id: "336", name: "Other" }
        }
      },
      "32": {
        id: "32",
        name: "Shorts",
        subcategories: {
          "337": { id: "337", name: "Athletic" },
          "338": { id: "338", name: "Board, surf" },
          "339": { id: "339", name: "Cargo" },
          "340": { id: "340", name: "Carpenter, utility" },
          "341": { id: "341", name: "Casual shorts" },
          "342": { id: "342", name: "Corduroys" },
          "343": { id: "343", name: "Denim" },
          "344": { id: "344", name: "Dress shorts" },
          "345": { id: "345", name: "Khakis, chinos" },
          "346": { id: "346", name: "Other" }
        }
      },
      "33": {
        id: "33",
        name: "Coats & jackets",
        subcategories: {
          "347": { id: "347", name: "Fleece jacket" },
          "348": { id: "348", name: "Flight/bomber" },
          "349": { id: "349", name: "Jean jacket" },
          "350": { id: "350", name: "Military" },
          "351": { id: "351", name: "Motorcycle" },
          "352": { id: "352", name: "Parka" },
          "353": { id: "353", name: "Peacoat" },
          "354": { id: "354", name: "Poncho" },
          "355": { id: "355", name: "Puffer" },
          "356": { id: "356", name: "Rainwear" },
          "357": { id: "357", name: "Trench" },
          "358": { id: "358", name: "Varsity/baseball" },
          "359": { id: "359", name: "Vest" },
          "360": { id: "360", name: "Windbreaker" },
          "361": { id: "361", name: "Wool" },
          "362": { id: "362", name: "Other" }
        }
      },
      "34": {
        id: "34",
        name: "Blazers & sport coats",
        subcategories: {
          "363": { id: "363", name: "Double breasted" },
          "364": { id: "364", name: "Four button" },
          "365": { id: "365", name: "One button" },
          "366": { id: "366", name: "Three button" },
          "367": { id: "367", name: "Two button" },
          "368": { id: "368", name: "Other" }
        }
      },
      "35": {
        id: "35",
        name: "Suits",
        subcategories: {
          "369": { id: "369", name: "One button" },
          "370": { id: "370", name: "Two button" },
          "371": { id: "371", name: "Three button" },
          "372": { id: "372", name: "Four button" },
          "373": { id: "373", name: "Double breasted" },
          "374": { id: "374", name: "Tuxedo" },
          "375": { id: "375", name: "Other" }
        }
      },
      "36": {
        id: "36",
        name: "Athletic apparel",
        subcategories: {
          "376": { id: "376", name: "Competitive swimwear" },
          "377": { id: "377", name: "Jackets" },
          "378": { id: "378", name: "Jerseys" },
          "379": { id: "379", name: "Pants" },
          "381": { id: "381", name: "Shorts" },
          "383": { id: "383", name: "Socks" },
          "385": { id: "385", name: "Vests" },
          "386": { id: "386", name: "Other" },
          "2009": { id: "2009", name: "Athletic Polos" },
          "2010": { id: "2010", name: "Athletic Long Sleeve Shirts" },
          "2011": { id: "2011", name: "Athletic Short Sleeve Shirts" },
          "2012": { id: "2012", name: "Jerseys" },
          "2013": { id: "2013", name: "Athletic T-Shirts" },
          "2014": { id: "2014", name: "Athletic Tank Tops" },
          "2015": { id: "2015", name: "Snow Bibs" },
          "2016": { id: "2016", name: "Snow Pants" },
          "2017": { id: "2017", name: "Snowsuits" },
          "2018": { id: "2018", name: "Athletic Hoodies" },
          "2019": { id: "2019", name: "Athletic Sweat Pants" },
          "2020": { id: "2020", name: "Athletic Sweatshirts" },
          "2022": { id: "2022", name: "Track Pants" },
          "2023": { id: "2023", name: "Tracksuits" }
        }
      },
      "37": {
        id: "37",
        name: "Swimwear",
        subcategories: {
          "387": { id: "387", name: "Board shorts" },
          "388": { id: "388", name: "Swim briefs" },
          "389": { id: "389", name: "Swim trunks" }
        }
      },
      "38": {
        id: "38",
        name: "Men's accessories",
        subcategories: {
          "391": { id: "391", name: "Belts" },
          "392": { id: "392", name: "Hats" },
          "393": { id: "393", name: "Sunglasses" },
          "394": { id: "394", name: "Ties" },
          "395": { id: "395", name: "Watches" },
          "396": { id: "396", name: "Other" },
          "1560": { id: "1560", name: "Wallets" },
          "2024": { id: "2024", name: "Backpacks" },
          "2025": { id: "2025", name: "Bags" },
          "2026": { id: "2026", name: "Briefcases" },
          "2519": { id: "2519", name: "Bandanas" },
          "2520": { id: "2520", name: "Bow Ties" },
          "2521": { id: "2521", name: "Collar Stays" },
          "2522": { id: "2522", name: "Fashion Gloves" },
          "2523": { id: "2523", name: "Handkerchiefs" },
          "2524": { id: "2524", name: "Scarves" },
          "2525": { id: "2525", name: "Turbans" },
          "2526": { id: "2526", name: "Umbrellas" },
          "2881": { id: "2881", name: "Cardholders" }
        }
      },
      "39": {
        id: "39",
        name: "Shoes",
        subcategories: {
          "397": { id: "397", name: "Athletic" },
          "398": { id: "398", name: "Boots" },
          "399": { id: "399", name: "Fashion sneakers" },
          "402": { id: "402", name: "Outdoor" },
          "403": { id: "403", name: "Oxfords" },
          "404": { id: "404", name: "Sandals" },
          "405": { id: "405", name: "Slippers" },
          "406": { id: "406", name: "Work & safety" },
          "2027": { id: "2027", name: "Loafers" },
          "2028": { id: "2028", name: "Slip-Ons" },
          "2029": { id: "2029", name: "Clogs" },
          "2030": { id: "2030", name: "Mules" }
        }
      },
      "40": { id: "40", name: "Other" },
      "2874": {
        id: "2874",
        name: "Jewelry",
        subcategories: {
          "2875": { id: "2875", name: "Bracelets" },
          "2876": { id: "2876", name: "Cufflinks" },
          "2877": { id: "2877", name: "Earrings" },
          "2878": { id: "2878", name: "Necklaces" },
          "2879": { id: "2879", name: "Pins" },
          "2880": { id: "2880", name: "Rings" }
        }
      }
    }
  },
  "7": {
    id: "7",
    name: "Electronics",
    subcategories: {
      "80": {
        id: "80",
        name: "Cameras & photography",
        subcategories: {
          "759": { id: "759", name: "Digital cameras" },
          "760": { id: "760", name: "Camcorders" },
          "761": { id: "761", name: "Camera & photo accessories" },
          "766": { id: "766", name: "Lighting & studio" },
          "767": { id: "767", name: "Film & Polaroid Cameras" },
          "768": { id: "768", name: "Other" },
          "2134": { id: "2134", name: "Camera Filters" },
          "2135": { id: "2135", name: "Camera Lenses" },
          "2136": { id: "2136", name: "Photography Supports" },
          "2137": { id: "2137", name: "Photography Tripods" },
          "2138": { id: "2138", name: "Camera Flash Accessories" },
          "2139": { id: "2139", name: "Camera Flashes" },
          "2140": { id: "2140", name: "Binoculars" },
          "2141": { id: "2141", name: "Telescopes" },
          "2205": { id: "2205", name: "Sport Cameras" },
          "2206": { id: "2206", name: "Waterproof Cameras" },
          "2207": { id: "2207", name: "Camera Films" },
          "2208": { id: "2208", name: "Polaroid Films" }
        }
      },
      "81": {
        id: "81",
        name: "Computers & Laptops",
        subcategories: {
          "774": { id: "774", name: "Networking & connectivity" },
          "777": { id: "777", name: "Other" },
          "1595": { id: "1595", name: "Monitors & Screens" },
          "1596": { id: "1596", name: "Computer Accessories" },
          "2145": { id: "2145", name: "Laptops" },
          "2146": { id: "2146", name: "Netbooks" },
          "2147": { id: "2147", name: "Desktops Computers" },
          "2148": { id: "2148", name: "All-In-One Computers" },
          "2149": { id: "2149", name: "Printers" },
          "2150": { id: "2150", name: "Printing Supplies" },
          "2151": { id: "2151", name: "Scanners" },
          "2152": { id: "2152", name: "Computer Drives" },
          "2153": { id: "2153", name: "Computer Media" },
          "2154": { id: "2154", name: "Computer Storage" },
          "2268": { id: "2268", name: "All-In-One Printers" }
        }
      },
      "82": {
        id: "82",
        name: "Cell phones & accessories",
        subcategories: {
          "778": { id: "778", name: "Cell phones & smartphones" },
          "779": { id: "779", name: "Cell phone accessories" },
          "780": { id: "780", name: "Headsets" },
          "782": { id: "782", name: "Screen protectors" },
          "784": { id: "784", name: "Batteries" },
          "786": { id: "786", name: "Other" },
          "2155": { id: "2155", name: "Cell Phone Cases" },
          "2156": { id: "2156", name: "Cell Phone Covers" },
          "2157": { id: "2157", name: "Cell Phone Skins" },
          "2158": { id: "2158", name: "Cell Phone Chargers" },
          "2159": { id: "2159", name: "Cell Phone Cradles" },
          "2160": { id: "2160", name: "Cell Phone Adapters" },
          "2161": { id: "2161", name: "Cell Phone Cables" },
          "2631": { id: "2631", name: "Wireless Cell Phone Chargers" }
        }
      },
      "83": {
        id: "83",
        name: "TV & Video",
        subcategories: {
          "787": { id: "787", name: "Televisions" },
          "794": { id: "794", name: "Gadgets" },
          "795": { id: "795", name: "Other" },
          "1578": { id: "1578", name: "Streaming Devices" },
          "2164": { id: "2164", name: "Blu-ray Players" },
          "2165": { id: "2165", name: "DVD Players" },
          "2201": { id: "2201", name: "Projector Screens" },
          "2202": { id: "2202", name: "Projectors" },
          "2632": { id: "2632", name: "DVRs" }
        }
      },
      "84": {
        id: "84",
        name: "Video games & consoles",
        subcategories: {
          "796": { id: "796", name: "Games" },
          "797": { id: "797", name: "Consoles" },
          "798": { id: "798", name: "Accessories" },
          "800": { id: "800", name: "Strategy guides" },
          "802": { id: "802", name: "Replacement parts & tools" },
          "803": { id: "803", name: "Other" },
          "1599": { id: "1599", name: "PC Gaming" }
        }
      },
      "85": {
        id: "85",
        name: "Car audio, video & gps",
        subcategories: {
          "805": { id: "805", name: "GPS units & equipment" },
          "806": { id: "806", name: "Car speakers & systems" },
          "807": { id: "807", name: "Car subwoofers" },
          "808": { id: "808", name: "Car video" },
          "809": { id: "809", name: "Car security & convenience" },
          "810": { id: "810", name: "Car A/V installation" },
          "813": { id: "813", name: "Other" },
          "2166": { id: "2166", name: "Car Amplifiers" },
          "2167": { id: "2167", name: "Car CD Changers" },
          "2168": { id: "2168", name: "Car Equalizers" },
          "2169": { id: "2169", name: "Car Stereo Receivers" },
          "2170": { id: "2170", name: "GPS Accessories" },
          "2171": { id: "2171", name: "GPS Car Mounts" },
          "2246": { id: "2246", name: "Car Coaxial Speakers" },
          "2247": { id: "2247", name: "Car Component Speakers" },
          "2248": { id: "2248", name: "Car Mid-Range Speakers" },
          "2249": { id: "2249", name: "Car Tweeters" },
          "2250": { id: "2250", name: "Car Woofers" }
        }
      },
      "86": {
        id: "86",
        name: "Media",
        subcategories: {
          "814": { id: "814", name: "Blu-ray" },
          "815": { id: "815", name: "DVD" },
          "816": { id: "816", name: "CD" },
          "817": { id: "817", name: "VHS" },
          "818": { id: "818", name: "Other" }
        }
      },
      "87": { id: "87", name: "Other" },
      "775": {
        id: "775",
        name: "Computer Components & Parts",
        subcategories: {
          "2251": { id: "2251", name: "Computer Case Fans" },
          "2252": { id: "2252", name: "Computer Controller Cards" },
          "2253": { id: "2253", name: "Computer CPUs" },
          "2254": { id: "2254", name: "Computer Drive Enclosures" },
          "2255": { id: "2255", name: "Computer GPUs" },
          "2256": { id: "2256", name: "Computer Memory (RAM)" },
          "2257": { id: "2257", name: "Computer Motherboards" },
          "2258": { id: "2258", name: "Computer Power Supplies" },
          "2259": { id: "2259", name: "Computer Sound Cards" },
          "2260": { id: "2260", name: "CPU Fans" },
          "2261": { id: "2261", name: "Desktop Cases" },
          "2262": { id: "2262", name: "Heatsinks" },
          "2263": { id: "2263", name: "I/O Adapters" },
          "2264": { id: "2264", name: "PC Water Cooling Accessories" },
          "2265": { id: "2265", name: "PC Water Cooling Kits" },
          "2266": { id: "2266", name: "Thermal Compound" },
          "2267": { id: "2267", name: "Other Computer Parts & Components" }
        }
      },
      "801": {
        id: "801",
        name: "Video Game Merchandise",
        subcategories: {
          "3503": { id: "3503", name: "Interactive Gaming Figures" },
          "3504": { id: "3504", name: "Interactive Video Game Cards" },
          "3505": { id: "3505", name: "Other Video Game Merchandise" }
        }
      },
      "1573": {
        id: "1573",
        name: "Wearables",
        subcategories: {
          "1574": { id: "1574", name: "Smart Watches" },
          "1575": { id: "1575", name: "Smart Watch Accessories" },
          "1576": { id: "1576", name: "Fitness Trackers" }
        }
      },
      "1580": {
        id: "1580",
        name: "Smart Home & Security",
        subcategories: {
          "791": { id: "791", name: "Home surveillance" },
          "1581": { id: "1581", name: "Smart Thermostats" },
          "1582": { id: "1582", name: "Smart Lighting" },
          "1583": { id: "1583", name: "Smart Locks" },
          "1584": { id: "1584", name: "Smart Speakers & Assistants" },
          "1585": { id: "1585", name: "Smart Cleaning Appliances" },
          "1586": { id: "1586", name: "Other" }
        }
      },
      "1587": {
        id: "1587",
        name: "Home Audio",
        subcategories: {
          "788": { id: "788", name: "Other Home Audio" },
          "793": { id: "793", name: "Audio Accessories" },
          "1556": { id: "1556", name: "Studio recording equipment" },
          "1588": { id: "1588", name: "Bluetooth Speakers" },
          "1590": { id: "1590", name: "Docking Stations" },
          "1591": { id: "1591", name: "Radios" },
          "1592": { id: "1592", name: "Portable Stereos & Boomboxes" },
          "2162": { id: "2162", name: "Home Speakers" },
          "2163": { id: "2163", name: "Home Subwoofers" },
          "2197": { id: "2197", name: "Microphone Accessories" },
          "2198": { id: "2198", name: "Microphones" },
          "2199": { id: "2199", name: "DJ Equipment" },
          "2200": { id: "2200", name: "Karaoke Equipment" },
          "2203": { id: "2203", name: "CD Players" },
          "2204": { id: "2204", name: "Record Players" },
          "2269": { id: "2269", name: "Compact Stereos" },
          "2270": { id: "2270", name: "DA Converters" },
          "2271": { id: "2271", name: "Home Audio Amplifiers" },
          "2272": { id: "2272", name: "Home Audio Cables" },
          "2273": { id: "2273", name: "Home Audio CD/SACD Players" },
          "2274": { id: "2274", name: "Home Audio Equalizers" },
          "2275": { id: "2275", name: "Home Audio Integrated Amplifiers" },
          "2276": { id: "2276", name: "Home Audio Interconnects" },
          "2277": { id: "2277", name: "Home Audio Preamplifiers" },
          "2278": { id: "2278", name: "Home Audio Receivers" },
          "2279": { id: "2279", name: "Home Audio Sound Bars" },
          "2280": { id: "2280", name: "Home Audio Tape Decks" },
          "2281": { id: "2281", name: "Home Audio Turntables" },
          "2282": { id: "2282", name: "Music Streamers" },
          "2283": { id: "2283", name: "Radio Tuners" }
        }
      },
      "1593": {
        id: "1593",
        name: "Headphones & MP3 Players",
        subcategories: {
          "789": { id: "789", name: "Headphones" },
          "1577": { id: "1577", name: "MP3 Players" },
          "1594": { id: "1594", name: "Bluetooth Headphones" }
        }
      },
      "1597": {
        id: "1597",
        name: "Tablets & E-readers",
        subcategories: {
          "769": { id: "769", name: "iPad/tablet/ebook readers" },
          "1602": { id: "1602", name: "Tablet Accessories" },
          "2142": { id: "2142", name: "Tablet Cases" },
          "2143": { id: "2143", name: "Tablet Covers" },
          "2144": { id: "2144", name: "Tablet Skins" }
        }
      },
      "1603": {
        id: "1603",
        name: "Drones",
        subcategories: {
          "1604": { id: "1604", name: "Drones" },
          "1605": { id: "1605", name: "Drone Accessories" }
        }
      },
      "1606": {
        id: "1606",
        name: "Virtual Reality",
        subcategories: {
          "1607": { id: "1607", name: "VR Headsets" },
          "1608": { id: "1608", name: "VR Phone Cases" },
          "1609": { id: "1609", name: "VR Accessories" },
          "1610": { id: "1610", name: "VR Games" }
        }
      }
    }
  },
  "1611": {
    id: "1611",
    name: "Toys & Collectibles",
    subcategories: {
      "1612": {
        id: "1612",
        name: "Action Figures & Accessories",
        subcategories: {
          "1613": { id: "1613", name: "Action Figures" },
          "1616": { id: "1616", name: "Action Figure Accessories" },
          "1618": { id: "1618", name: "Action Figure Playsets" }
        }
      },
      "1619": {
        id: "1619",
        name: "Dolls & Accessories",
        subcategories: {
          "1620": { id: "1620", name: "Fashion Dolls" },
          "1621": { id: "1621", name: "Baby Dolls" },
          "1622": { id: "1622", name: "Interactive Dolls & Pets" },
          "1623": { id: "1623", name: "Dollhouses & Play Sets" },
          "1624": { id: "1624", name: "Dollhouse Furniture & Accessories" },
          "1625": { id: "1625", name: "Doll Clothes" },
          "1626": { id: "1626", name: "Doll Accessories" },
          "1627": { id: "1627", name: "Mini Dolls & Playsets" },
          "1628": { id: "1628", name: "Play Animals" }
        }
      },
      "1629": {
        id: "1629",
        name: "Collectibles & Hobbies",
        subcategories: {
          "1631": { id: "1631", name: "Model Vehicles" },
          "1632": { id: "1632", name: "Model Kits" },
          "1633": { id: "1633", name: "Squishies" },
          "1634": { id: "1634", name: "Figurines" },
          "1635": { id: "1635", name: "Glass" },
          "1636": { id: "1636", name: "Souvenirs & Memorabilia" },
          "1637": { id: "1637", name: "Porcelain" },
          "1638": { id: "1638", name: "Dolls" },
          "1639": { id: "1639", name: "Arcade" },
          "1640": { id: "1640", name: "Autographs" },
          "1641": { id: "1641", name: "Comics" },
          "1642": { id: "1642", name: "Paper Collectibles" },
          "1643": { id: "1643", name: "Keychains" },
          "1644": { id: "1644", name: "Pins" },
          "1645": { id: "1645", name: "Rocks, Fossils & Minerals" },
          "1646": { id: "1646", name: "Bags & Totes" },
          "1647": { id: "1647", name: "Other" },
          "2209": { id: "2209", name: "Bobbleheads" },
          "2210": { id: "2210", name: "Toy Statues" },
          "3569": { id: "3569", name: "Photocards" }
        }
      },
      "1648": {
        id: "1648",
        name: "Building Toys",
        subcategories: {
          "1650": { id: "1650", name: "Stacking Blocks" },
          "1651": { id: "1651", name: "Wooden Blocks" },
          "1652": { id: "1652", name: "Magnetic Construction" },
          "1653": { id: "1653", name: "Building Kit Accessories" },
          "2211": { id: "2211", name: "LEGO Toys" },
          "2212": { id: "2212", name: "Toy Building Blocks" }
        }
      },
      "1654": {
        id: "1654",
        name: "Electronics for Kids",
        subcategories: {
          "1656": { id: "1656", name: "Electronic Games" },
          "1657": { id: "1657", name: "Kids Headphones" },
          "1660": { id: "1660", name: "Toy Walkie Talkies" },
          "1661": { id: "1661", name: "Kids Computer & Tablet Accessories" },
          "1663": { id: "1663", name: "Kids Telescopes" },
          "1664": { id: "1664", name: "Wind-Up & Walking Toys" },
          "1665": { id: "1665", name: "Toy Cameras" },
          "1666": { id: "1666", name: "Kids Watches" },
          "1667": { id: "1667", name: "Other" },
          "2213": { id: "2213", name: "Kids Computers" },
          "2214": { id: "2214", name: "Kids Tablets" },
          "2215": { id: "2215", name: "Kids Karaoke" },
          "2216": { id: "2216", name: "Kids Music Players" },
          "2217": { id: "2217", name: "Toy Electric Pets" },
          "2218": { id: "2218", name: "Toy Robots" },
          "2219": { id: "2219", name: "Toy Alarm Clocks" },
          "2220": { id: "2220", name: "Toy Phones" }
        }
      },
      "1668": {
        id: "1668",
        name: "Games & Puzzles",
        subcategories: {
          "1669": { id: "1669", name: "Board Games" },
          "1670": { id: "1670", name: "Card Games" },
          "1671": { id: "1671", name: "Chess & Checkers" },
          "1673": { id: "1673", name: "Tile Games" },
          "1674": { id: "1674", name: "Stacking Games" },
          "1675": { id: "1675", name: "Game Tables" },
          "1676": { id: "1676", name: "Game Accessories" },
          "1677": { id: "1677", name: "Jigsaw Puzzles" },
          "1678": { id: "1678", name: "Wooden Puzzles" },
          "1679": { id: "1679", name: "3-D Puzzles" },
          "1680": { id: "1680", name: "Dice Games" },
          "1681": { id: "1681", name: "Sudoku Puzzles" },
          "1682": { id: "1682", name: "Handheld Games" },
          "1683": { id: "1683", name: "Lawn Games" }
        }
      },
      "1684": {
        id: "1684",
        name: "Sports & Outdoor Play",
        subcategories: {
          "1686": { id: "1686", name: "Bubble Toys" },
          "1687": { id: "1687", name: "NERF & Blaster Guns" },
          "1688": { id: "1688", name: "NERF & Blaster Darts" },
          "1689": { id: "1689", name: "Bounce Houses" },
          "1690": { id: "1690", name: "Toy Kites" },
          "1692": { id: "1692", name: "Sand & Water Toys" },
          "1693": { id: "1693", name: "Play Sets & Playhouses" },
          "1694": { id: "1694", name: "Swing Sets" },
          "1695": { id: "1695", name: "Swing Set Accessories" },
          "1696": { id: "1696", name: "Trampolines" },
          "1697": { id: "1697", name: "Nature Exploration Toys" },
          "1700": { id: "1700", name: "Sleds & Snow Toys" },
          "1701": { id: "1701", name: "Ball Pits" },
          "1702": { id: "1702", name: "Pogo Sticks & Hoppers" },
          "1703": { id: "1703", name: "Other Outdoor Toys" },
          "2221": { id: "2221", name: "Playground Balls" },
          "2222": { id: "2222", name: "Toy Boomerangs" },
          "2223": { id: "2223", name: "Toy Frisbees" },
          "2224": { id: "2224", name: "Kids Wagons" },
          "2225": { id: "2225", name: "Scooters" },
          "2226": { id: "2226", name: "Tricycles" },
          "2227": { id: "2227", name: "Kids Helmets" },
          "2228": { id: "2228", name: "Kids Protective Pads" },
          "2229": { id: "2229", name: "Kids Hoverboards" },
          "2230": { id: "2230", name: "Kids Skateboards" },
          "2231": { id: "2231", name: "Kids Skates" }
        }
      },
      "1704": {
        id: "1704",
        name: "Remote Control Toys & Vehicles",
        subcategories: {
          "1705": { id: "1705", name: "Remote Control Vehicles & Animals" },
          "1706": { id: "1706", name: "Kids Drones & Flying Toys" },
          "1707": { id: "1707", name: "Play Vehicles" },
          "1708": { id: "1708", name: "Racetracks & Playsets" },
          "1709": { id: "1709", name: "Robotics" },
          "1710": { id: "1710", name: "Trains & Train Sets" },
          "1711": { id: "1711", name: "Toy Vehicle Accessories" }
        }
      },
      "1712": {
        id: "1712",
        name: "Stuffed Animals & Plush",
        subcategories: {
          "1713": { id: "1713", name: "Stuffed Animals" },
          "1714": { id: "1714", name: "Stuffed Animal Accessories" },
          "1715": { id: "1715", name: "Beanbag Plushies" },
          "1716": { id: "1716", name: "Plush Puppets" },
          "1717": { id: "1717", name: "Plush Figures" },
          "1719": { id: "1719", name: "Plush Purses & Accessories" },
          "2232": { id: "2232", name: "Character Blankets" },
          "2233": { id: "2233", name: "Character Pillows" }
        }
      },
      "1720": {
        id: "1720",
        name: "Arts & Crafts",
        subcategories: {
          "1721": { id: "1721", name: "Craft Kits" },
          "1722": { id: "1722", name: "Clay, Dough & Pottery Kits" },
          "1723": { id: "1723", name: "Drawing & Coloring" },
          "1724": { id: "1724", name: "Easels & Art Tables" },
          "1725": { id: "1725", name: "Jewelry & Bead Kits" },
          "1727": { id: "1727", name: "Stickers" },
          "1729": { id: "1729", name: "Kids Scissors" },
          "1730": { id: "1730", name: "Aprons & Smocks" },
          "2234": { id: "2234", name: "Glue" },
          "2235": { id: "2235", name: "Paste" }
        }
      },
      "1731": {
        id: "1731",
        name: "Baby & Toddler Toys",
        subcategories: {
          "1733": { id: "1733", name: "Soft & Plush Toys" },
          "1734": { id: "1734", name: "Soothers" },
          "1735": { id: "1735", name: "Car Seat & Stroller Toys" },
          "1736": { id: "1736", name: "Baby Learning Toys" },
          "1737": { id: "1737", name: "Push & Pull Toys" },
          "1738": { id: "1738", name: "Baby & Toddler Books" },
          "1739": { id: "1739", name: "Baby & Toddler Blocks" },
          "1740": { id: "1740", name: "Shape & Color Sorters" },
          "1741": { id: "1741", name: "Bath Toys" },
          "1742": { id: "1742", name: "Baby Music & Sound Toys" },
          "1743": { id: "1743", name: "Crib Toys" },
          "1744": { id: "1744", name: "Other" },
          "2237": { id: "2237", name: "Baby Rattles" },
          "2238": { id: "2238", name: "Baby Teethers" }
        }
      },
      "1745": {
        id: "1745",
        name: "Learning & Education Toys",
        subcategories: {
          "1746": { id: "1746", name: "Music & Art Learning Toys" },
          "1747": { id: "1747", name: "Math Toys" },
          "1748": { id: "1748", name: "Counting Toys" },
          "1749": { id: "1749", name: "Alphabet Toys" },
          "1750": { id: "1750", name: "Reading & Writing Toys" },
          "1751": { id: "1751", name: "Geography & History Toys" },
          "1752": { id: "1752", name: "Engineering Toys" },
          "1753": { id: "1753", name: "STEM Toys" },
          "1754": { id: "1754", name: "Science Toys" },
          "1755": { id: "1755", name: "Bilingual Toys" },
          "1756": { id: "1756", name: "Special Needs Learning Toys" },
          "1757": { id: "1757", name: "Learning & Development Toys" },
          "1758": { id: "1758", name: "Electronic Learning Toys" }
        }
      },
      "1759": {
        id: "1759",
        name: "Dress Up & Pretend Play",
        subcategories: {
          "1760": { id: "1760", name: "Play Cooking & Baking" },
          "1762": { id: "1762", name: "Play Tool Sets" },
          "1763": { id: "1763", name: "Toddler & Baby Costumes" },
          "1764": { id: "1764", name: "Kids Costumes" },
          "1765": { id: "1765", name: "Playhouses" },
          "1766": { id: "1766", name: "Spy Gear" },
          "1767": { id: "1767", name: "Puppets" },
          "1768": { id: "1768", name: "Play Medical Toys" },
          "1769": { id: "1769", name: "Play Gardening Toys" },
          "1770": { id: "1770", name: "Other" },
          "2239": { id: "2239", name: "Play Teepees" },
          "2240": { id: "2240", name: "Play Tents" },
          "2241": { id: "2241", name: "Play Tunnels" }
        }
      },
      "1771": {
        id: "1771",
        name: "Novelty & Gag Toys",
        subcategories: {
          "1772": { id: "1772", name: "Fidget Toys" },
          "1773": { id: "1773", name: "Fortune Telling Toys" },
          "1774": { id: "1774", name: "Gag Toys & Practical Jokes" },
          "1775": { id: "1775", name: "Juggling Sets" },
          "1776": { id: "1776", name: "Magic Kits & Accessories" },
          "1777": { id: "1777", name: "Novelty Spinning Tops" },
          "1779": { id: "1779", name: "Novelty Surprise Toys" },
          "2242": { id: "2242", name: "Toy Putty" },
          "2243": { id: "2243", name: "Toy Slime" }
        }
      },
      "1780": {
        id: "1780",
        name: "Trading Cards",
        subcategories: {
          "1789": { id: "1789", name: "Other Trading Cards" },
          "3506": { id: "3506", name: "Booster Packs" },
          "3507": { id: "3507", name: "Trading Card Boxes" },
          "3508": { id: "3508", name: "Trading Card Decks" },
          "3509": { id: "3509", name: "Single Cards" },
          "3510": { id: "3510", name: "Trading Card Tins" }
        }
      },
      "1790": {
        id: "1790",
        name: "Vintage & Antique Toys",
        subcategories: {
          "1791": { id: "1791", name: "Dolls" },
          "1792": { id: "1792", name: "Games" },
          "1793": { id: "1793", name: "Animals" },
          "1794": { id: "1794", name: "Action Figures" },
          "1795": { id: "1795", name: "Children" },
          "1796": { id: "1796", name: "Cars" },
          "1797": { id: "1797", name: "Puzzles" },
          "1798": { id: "1798", name: "Sports" },
          "1799": { id: "1799", name: "Blocks" },
          "1800": { id: "1800", name: "Electronics" },
          "1801": { id: "1801", name: "Antique Toys" },
          "1802": { id: "1802", name: "Other" }
        }
      },
      "1803": {
        id: "1803",
        name: "Vintage & Antique Collectibles",
        subcategories: {
          "1804": { id: "1804", name: "Model Vehicles" },
          "1805": { id: "1805", name: "Model Kits" },
          "1806": { id: "1806", name: "Figurines" },
          "1807": { id: "1807", name: "Glass" },
          "1808": { id: "1808", name: "Souvenirs & Memorabilia" },
          "1809": { id: "1809", name: "Porcelain" },
          "1810": { id: "1810", name: "Arcade" },
          "1811": { id: "1811", name: "Paper Collectibles" },
          "1812": { id: "1812", name: "Antique Collectibles" },
          "1813": { id: "1813", name: "Other" }
        }
      },
      "1814": {
        id: "1814",
        name: "Handmade Toys",
        subcategories: {
          "1815": { id: "1815", name: "Plush" },
          "1816": { id: "1816", name: "Children" },
          "1817": { id: "1817", name: "Waldorf" },
          "1818": { id: "1818", name: "Dolls" },
          "1820": { id: "1820", name: "Food" },
          "1821": { id: "1821", name: "Puzzles" },
          "1822": { id: "1822", name: "Baby" },
          "1823": { id: "1823", name: "Pretend" },
          "1824": { id: "1824", name: "Bears" },
          "1825": { id: "1825", name: "Amigurumi" },
          "1826": { id: "1826", name: "Games" },
          "1828": { id: "1828", name: "Doll clothes" },
          "1829": { id: "1829", name: "Sports" },
          "1830": { id: "1830", name: "Blythe" },
          "1831": { id: "1831", name: "Other" }
        }
      },
      "1832": {
        id: "1832",
        name: "Handmade Dolls & Miniatures",
        subcategories: {
          "1833": { id: "1833", name: "Scale dollhouse miniatures" },
          "1834": { id: "1834", name: "Miniatures" },
          "1835": { id: "1835", name: "Primitive" },
          "1836": { id: "1836", name: "Art dolls" },
          "1837": { id: "1837", name: "Animals" },
          "1838": { id: "1838", name: "Waldorf" },
          "1839": { id: "1839", name: "Plush" },
          "1840": { id: "1840", name: "Soft Sculptures" },
          "1841": { id: "1841", name: "Fantasy" },
          "1842": { id: "1842", name: "Figurines" },
          "1843": { id: "1843", name: "Child friendly" },
          "1844": { id: "1844", name: "Artist bears" },
          "1845": { id: "1845", name: "Amigurumi" },
          "1846": { id: "1846", name: "Human Figure Dolls" },
          "1847": { id: "1847", name: "Scale Models" },
          "1848": { id: "1848", name: "Fashion Doll Apparel" },
          "1849": { id: "1849", name: "Puppets" },
          "1850": { id: "1850", name: "Other" }
        }
      },
      "1851": { id: "1851", name: "Other" },
      "3511": {
        id: "3511",
        name: "Sports Trading Cards",
        subcategories: {
          "1787": { id: "1787", name: "Other Sports Trading Cards" },
          "2596": { id: "2596", name: "Auto Racing Trading Cards" },
          "2597": { id: "2597", name: "Baseball Trading Cards" },
          "2598": { id: "2598", name: "Basketball Trading Cards" },
          "2599": { id: "2599", name: "Boxing Trading Cards" },
          "2600": { id: "2600", name: "Football Trading Cards" },
          "2601": { id: "2601", name: "Hockey Trading Cards" },
          "2602": { id: "2602", name: "Soccer Trading Cards" },
          "3512": { id: "3512", name: "Wrestling Trading Cards" }
        }
      }
    }
  },
  "4": {
    id: "4",
    name: "Home",
    subcategories: {
      "60": {
        id: "60",
        name: "Kids' home store",
        subcategories: {
          "567": { id: "567", name: "Kids' bedding" },
          "568": { id: "568", name: "Kids' flatware" },
          "569": { id: "569", name: "Kids' furniture" },
          "570": { id: "570", name: "Kids' room décor" },
          "571": { id: "571", name: "Nursery décor" },
          "574": { id: "574", name: "Kids' bath" },
          "575": { id: "575", name: "Other" },
          "1862": { id: "1862", name: "Kids' Storage" }
        }
      },
      "61": {
        id: "61",
        name: "Kitchen & dining",
        subcategories: {
          "589": { id: "589", name: "Other" },
          "2069": { id: "2069", name: "Home Brewing Supplies" },
          "2070": { id: "2070", name: "Wine Making Supplies" },
          "2071": { id: "2071", name: "Cutlery Accessories" },
          "2073": { id: "2073", name: "Water Coolers" },
          "2074": { id: "2074", name: "Water Filters" }
        }
      },
      "62": {
        id: "62",
        name: "Bedding",
        subcategories: {
          "593": { id: "593", name: "Quilts" },
          "594": { id: "594", name: "Bed pillows" },
          "596": { id: "596", name: "Bed in a bag" },
          "600": { id: "600", name: "Mattress pads" },
          "601": { id: "601", name: "Inflatable beds" },
          "602": { id: "602", name: "Feather beds" },
          "603": { id: "603", name: "Other" },
          "2075": { id: "2075", name: "Bedspreads" },
          "2076": { id: "2076", name: "Coverlets" },
          "2077": { id: "2077", name: "Comforter Sets" },
          "2078": { id: "2078", name: "Comforters" },
          "2079": { id: "2079", name: "Duvet Covers" },
          "2080": { id: "2080", name: "Duvet Sets" },
          "2081": { id: "2081", name: "Bed Sheets" },
          "2082": { id: "2082", name: "Pillowcases" },
          "2083": { id: "2083", name: "Bed Skirts" },
          "2084": { id: "2084", name: "Shams" },
          "2085": { id: "2085", name: "Decorative Pillows" },
          "2086": { id: "2086", name: "Pillow Covers" },
          "2087": { id: "2087", name: "Pillow Inserts" },
          "2088": { id: "2088", name: "Blankets" },
          "2089": { id: "2089", name: "Throws" }
        }
      },
      "63": {
        id: "63",
        name: "Bath",
        subcategories: {
          "604": { id: "604", name: "Bath linen sets" },
          "605": { id: "605", name: "Bath rugs" },
          "606": { id: "606", name: "Bathroom accessories" },
          "607": { id: "607", name: "Bathroom furniture sets" },
          "608": { id: "608", name: "Towels" },
          "610": { id: "610", name: "Other" }
        }
      },
      "64": {
        id: "64",
        name: "Furniture",
        subcategories: {
          "613": { id: "613", name: "Home bar furniture" },
          "614": { id: "614", name: "Entertainment Centers & TV Stands" }
        }
      },
      "65": {
        id: "65",
        name: "Home decor",
        subcategories: {
          "622": { id: "622", name: "Baskets" },
          "624": { id: "624", name: "Clocks" },
          "625": { id: "625", name: "Decorative pillows" },
          "626": { id: "626", name: "Doormats" },
          "627": { id: "627", name: "Doorstops" },
          "628": { id: "628", name: "Draft stoppers" },
          "630": { id: "630", name: "Home decor accents" },
          "631": { id: "631", name: "Home fragrance" },
          "633": { id: "633", name: "Mirrors" },
          "635": { id: "635", name: "Slipcovers" },
          "636": { id: "636", name: "Tapestries" },
          "637": { id: "637", name: "Window treatments" },
          "638": { id: "638", name: "Vases" },
          "639": { id: "639", name: "Other" },
          "2090": { id: "2090", name: "Area Rugs" },
          "2091": { id: "2091", name: "Rug Pads" },
          "2092": { id: "2092", name: "Candle Holders" },
          "2093": { id: "2093", name: "Candle Warmers" },
          "2094": { id: "2094", name: "Fragrance Oils" },
          "2095": { id: "2095", name: "Home Candles" },
          "2096": { id: "2096", name: "Other Candle Accessories" },
          "2097": { id: "2097", name: "Wax Melts" },
          "2098": { id: "2098", name: "Fireplace Accessories" },
          "2099": { id: "2099", name: "Fireplaces" },
          "2100": { id: "2100", name: "Home Decor Lamps" },
          "2101": { id: "2101", name: "Home Decor Lighting" },
          "2102": { id: "2102", name: "Home Decor Lamp Accessories" },
          "2103": { id: "2103", name: "Photo Albums" },
          "2104": { id: "2104", name: "Picture Frames" },
          "2825": { id: "2825", name: "Aromatherapy Diffusers" }
        }
      },
      "66": {
        id: "66",
        name: "Artwork",
        subcategories: {
          "640": { id: "640", name: "Drawings" },
          "642": { id: "642", name: "Paintings" },
          "643": { id: "643", name: "Photographs" },
          "645": { id: "645", name: "Other" },
          "2105": { id: "2105", name: "Etchings" },
          "2106": { id: "2106", name: "Lithographs" },
          "2107": { id: "2107", name: "Woodcuts" },
          "2108": { id: "2108", name: "Art Prints" },
          "2109": { id: "2109", name: "Posters" }
        }
      },
      "67": {
        id: "67",
        name: "Seasonal decor",
        subcategories: {
          "646": { id: "646", name: "Christmas" },
          "647": { id: "647", name: "Easter" },
          "648": { id: "648", name: "Halloween" },
          "649": { id: "649", name: "Valentine" },
          "650": { id: "650", name: "Patriotic" },
          "651": { id: "651", name: "Thanksgiving" },
          "652": { id: "652", name: "Birthday" },
          "653": { id: "653", name: "St patrick's" },
          "654": { id: "654", name: "Hanukkah" },
          "655": { id: "655", name: "Day of the dead" },
          "656": { id: "656", name: "New year's" },
          "657": { id: "657", name: "Other" }
        }
      },
      "68": {
        id: "68",
        name: "Home appliances",
        subcategories: {
          "658": { id: "658", name: "Air conditioners" },
          "659": { id: "659", name: "Air purifiers" },
          "660": { id: "660", name: "Dehumidifiers" },
          "661": { id: "661", name: "Dishwashers" },
          "662": { id: "662", name: "Garbage disposals" },
          "663": { id: "663", name: "Fans" },
          "665": { id: "665", name: "Garment steamers" },
          "666": { id: "666", name: "Humidifiers" },
          "668": { id: "668", name: "Kitchen appliances" },
          "669": { id: "669", name: "Microwaves" },
          "670": { id: "670", name: "Refrigerators" },
          "671": { id: "671", name: "Space heaters" },
          "2110": { id: "2110", name: "Freezers" },
          "2111": { id: "2111", name: "Ice Makers" },
          "2112": { id: "2112", name: "Ironing Boards" },
          "2113": { id: "2113", name: "Irons" },
          "2114": { id: "2114", name: "Home Floor Care" },
          "2115": { id: "2115", name: "Vacuums" },
          "2116": { id: "2116", name: "Dryers" },
          "2117": { id: "2117", name: "Washer & Dryer Sets" },
          "2118": { id: "2118", name: "Washers" },
          "2119": { id: "2119", name: "Beverage Coolers" },
          "2120": { id: "2120", name: "Wine Coolers" }
        }
      },
      "69": {
        id: "69",
        name: "Storage & organization",
        subcategories: {
          "677": { id: "677", name: "Bathroom storage & organization" },
          "678": { id: "678", name: "Clothing & closet storage" },
          "679": { id: "679", name: "Garage storage & organization" },
          "680": { id: "680", name: "Holiday decor storage" },
          "682": { id: "682", name: "Laundry storage & organization" },
          "684": { id: "684", name: "Trash & recycling" },
          "685": { id: "685", name: "Storage cabinets" },
          "686": { id: "686", name: "Jewelry boxes & organizers" },
          "687": { id: "687", name: "Other" },
          "2121": { id: "2121", name: "Storage Baskets" },
          "2122": { id: "2122", name: "Storage Bins" },
          "2123": { id: "2123", name: "Storage Drawers" },
          "2124": { id: "2124", name: "Storage Racks" },
          "2125": { id: "2125", name: "Storage Shelves" }
        }
      },
      "70": {
        id: "70",
        name: "Cleaning supplies",
        subcategories: {
          "688": { id: "688", name: "Air fresheners" },
          "689": { id: "689", name: "Brushes" },
          "690": { id: "690", name: "Dusting" },
          "691": { id: "691", name: "Gloves" },
          "692": { id: "692", name: "Household cleaners" },
          "693": { id: "693", name: "Mopping" },
          "694": { id: "694", name: "Paper towels" },
          "695": { id: "695", name: "Sponges" },
          "696": { id: "696", name: "Squeegees" },
          "697": { id: "697", name: "Sweeping" },
          "698": { id: "698", name: "Trash bags" },
          "700": { id: "700", name: "Other" }
        }
      },
      "71": { id: "71", name: "Other" },
      "576": {
        id: "576",
        name: "Kitchen Bakeware",
        subcategories: {
          "2297": { id: "2297", name: "Bakeware Sets" },
          "2298": { id: "2298", name: "Baking Sheets" },
          "2299": { id: "2299", name: "Bundt Pans" },
          "2300": { id: "2300", name: "Cake Pans" },
          "2301": { id: "2301", name: "Cookie Sheets" },
          "2302": { id: "2302", name: "Cupcake & Muffin Pans" },
          "2303": { id: "2303", name: "Loaf Pans" },
          "2304": { id: "2304", name: "Pie Tins" }
        }
      },
      "577": {
        id: "577",
        name: "Kitchen Coffee & Espresso Makers",
        subcategories: {
          "2340": { id: "2340", name: "Coffee Drippers" },
          "2341": { id: "2341", name: "Coffee Grinders" },
          "2342": { id: "2342", name: "Coffee Roasters" },
          "2343": { id: "2343", name: "Espresso & Cappuccino Machines" },
          "2344": { id: "2344", name: "Filter Coffee Machines" },
          "2345": { id: "2345", name: "French Presses" },
          "2346": { id: "2346", name: "Milk Frothers" }
        }
      },
      "578": {
        id: "578",
        name: "Kitchen Cookware",
        subcategories: {
          "2347": { id: "2347", name: "Casserole Pans" },
          "2348": { id: "2348", name: "Cookware Sets" },
          "2349": { id: "2349", name: "Dutch Ovens" },
          "2350": { id: "2350", name: "Fry Pans" },
          "2351": { id: "2351", name: "Griddle Pans" },
          "2352": { id: "2352", name: "Grill Pans" },
          "2353": { id: "2353", name: "Saucepans" },
          "2354": { id: "2354", name: "Saut Pans" },
          "2355": { id: "2355", name: "Skillets" },
          "2356": { id: "2356", name: "Steamers" },
          "2357": { id: "2357", name: "Stock Pots & Multipots" },
          "2358": { id: "2358", name: "Tagines" },
          "2359": { id: "2359", name: "Woks" },
          "2360": { id: "2360", name: "Other Cookware" }
        }
      },
      "579": {
        id: "579",
        name: "Kitchen Dinnerware",
        subcategories: {
          "2377": { id: "2377", name: "Appetizer Plates" },
          "2378": { id: "2378", name: "Bowls" },
          "2379": { id: "2379", name: "Dinner Plates" },
          "2380": { id: "2380", name: "Dinnerware Sets" },
          "2381": { id: "2381", name: "Salad Plates" },
          "2382": { id: "2382", name: "Other Dinnerware" }
        }
      },
      "580": {
        id: "580",
        name: "Kitchen Serveware",
        subcategories: {
          "2432": { id: "2432", name: "Beverage Dispensers" },
          "2433": { id: "2433", name: "Butter Dishes" },
          "2434": { id: "2434", name: "Cheese Boards" },
          "2435": { id: "2435", name: "Dessert & Cake Stands" },
          "2436": { id: "2436", name: "Gravy Boats" },
          "2437": { id: "2437", name: "Jugs" },
          "2438": { id: "2438", name: "Pitchers" },
          "2439": { id: "2439", name: "Salad Bowls" },
          "2440": { id: "2440", name: "Serving Baskets" },
          "2441": { id: "2441", name: "Serving Bowls" },
          "2442": { id: "2442", name: "Serving Platters" },
          "2443": { id: "2443", name: "Serving Trays" },
          "2444": { id: "2444", name: "Trivets" }
        }
      },
      "582": {
        id: "582",
        name: "Kitchen & Table Linens",
        subcategories: {
          "2284": { id: "2284", name: "Kitchen Aprons" },
          "2285": { id: "2285", name: "Kitchen Cloth Napkins" },
          "2286": { id: "2286", name: "Kitchen Napkin Holders" },
          "2287": { id: "2287", name: "Kitchen Napkin Rings" },
          "2288": { id: "2288", name: "Kitchen Oven Mitts" },
          "2289": { id: "2289", name: "Kitchen Potholders" },
          "2290": { id: "2290", name: "Kitchen Table Chargers" },
          "2291": { id: "2291", name: "Kitchen Table Linen Sets" },
          "2292": { id: "2292", name: "Kitchen Table Placemats" },
          "2293": { id: "2293", name: "Kitchen Table Runners" },
          "2294": { id: "2294", name: "Kitchen Tablecloths" },
          "2295": { id: "2295", name: "Kitchen Towels" },
          "2296": { id: "2296", name: "Other Kitchen Linens" }
        }
      },
      "584": {
        id: "584",
        name: "Kitchen Utensils",
        subcategories: {
          "2493": { id: "2493", name: "Cooking Food Turners" },
          "2494": { id: "2494", name: "Cooking Ladles" },
          "2495": { id: "2495", name: "Kitchen Basting Brushes" },
          "2496": { id: "2496", name: "Kitchen Choppers" },
          "2497": { id: "2497", name: "Kitchen Colanders" },
          "2498": { id: "2498", name: "Kitchen Graters" },
          "2499": { id: "2499", name: "Kitchen Peelers" },
          "2500": { id: "2500", name: "Kitchen Scoops" },
          "2501": { id: "2501", name: "Kitchen Sifters" },
          "2502": { id: "2502", name: "Kitchen Slicers & Mandolines" },
          "2503": { id: "2503", name: "Kitchen Spatulas" },
          "2504": { id: "2504", name: "Kitchen Spiralizers" },
          "2505": { id: "2505", name: "Kitchen Strainers" },
          "2506": { id: "2506", name: "Kitchen Tongs" },
          "2507": { id: "2507", name: "Kitchen Utensil Sets" },
          "2508": { id: "2508", name: "Kitchen Whisks" },
          "2509": { id: "2509", name: "Kitchen Zesters" },
          "2510": { id: "2510", name: "Lemon Squeezers" },
          "2511": { id: "2511", name: "Measuring Cups" },
          "2512": { id: "2512", name: "Measuring Spoons" },
          "2513": { id: "2513", name: "Pasta Servers" },
          "2514": { id: "2514", name: "Pizza Cutter" },
          "2515": { id: "2515", name: "Potato Mashers" },
          "2516": { id: "2516", name: "Salad Spinners" },
          "2517": { id: "2517", name: "Slotted Spoons" },
          "2518": { id: "2518", name: "Other Kitchen Utensils" }
        }
      },
      "585": {
        id: "585",
        name: "Kitchen Small Appliances",
        subcategories: {
          "2445": { id: "2445", name: "Air Fryers" },
          "2446": { id: "2446", name: "Blenders" },
          "2447": { id: "2447", name: "Chafing Dishes" },
          "2448": { id: "2448", name: "Chocolate Fountains" },
          "2449": { id: "2449", name: "Contact Grills" },
          "2450": { id: "2450", name: "Deep Fryers" },
          "2451": { id: "2451", name: "Electric Griddles" },
          "2452": { id: "2452", name: "Electric Skillets" },
          "2453": { id: "2453", name: "Food Processors" },
          "2454": { id: "2454", name: "Food Warming Trays" },
          "2455": { id: "2455", name: "Hand Blenders" },
          "2456": { id: "2456", name: "Hand Mixers" },
          "2457": { id: "2457", name: "Ice Cream Makers" },
          "2458": { id: "2458", name: "Juicers" },
          "2459": { id: "2459", name: "Kitchen Burners" },
          "2460": { id: "2460", name: "Kitchen Hot Plates" },
          "2461": { id: "2461", name: "Pasta Makers" },
          "2462": { id: "2462", name: "Popcorn Makers" },
          "2463": { id: "2463", name: "Pressure Cookers" },
          "2464": { id: "2464", name: "Rice Cookers" },
          "2465": { id: "2465", name: "Slow Cookers" },
          "2466": { id: "2466", name: "Soda Makers" },
          "2467": { id: "2467", name: "Sous Vide" },
          "2468": { id: "2468", name: "Stand Mixers" },
          "2470": { id: "2470", name: "Toaster Ovens" },
          "2471": { id: "2471", name: "Toasters" },
          "2472": { id: "2472", name: "Waffle Makers" },
          "2473": { id: "2473", name: "Other Small Appliances" }
        }
      },
      "586": {
        id: "586",
        name: "Kitchen Storage",
        subcategories: {
          "2474": { id: "2474", name: "Food Storage Bags" },
          "2475": { id: "2475", name: "Food Storage Containers" },
          "2476": { id: "2476", name: "Fruit Baskets" },
          "2477": { id: "2477", name: "Kitchen Bread Boxes" },
          "2478": { id: "2478", name: "Kitchen Canisters" },
          "2479": { id: "2479", name: "Kitchen Cling Films" },
          "2480": { id: "2480", name: "Kitchen Drawers Organizers" },
          "2481": { id: "2481", name: "Kitchen Foils" },
          "2482": { id: "2482", name: "Kitchen Jars" },
          "2483": { id: "2483", name: "Kitchen Pantry Organizers" },
          "2484": { id: "2484", name: "Kitchen Spice Jars" },
          "2485": { id: "2485", name: "Kitchen Spice Racks" },
          "2486": { id: "2486", name: "Kitchen Tote Bags" },
          "2487": { id: "2487", name: "Other Kitchen Storage" }
        }
      },
      "588": {
        id: "588",
        name: "Kitchen Bar & Wine Accessories",
        subcategories: {
          "2315": { id: "2315", name: "Bar Tool Sets" },
          "2316": { id: "2316", name: "Bottle Holders" },
          "2317": { id: "2317", name: "Bottle Openers" },
          "2318": { id: "2318", name: "Coasters" },
          "2319": { id: "2319", name: "Cocktail Shakers" },
          "2320": { id: "2320", name: "Decanters" },
          "2321": { id: "2321", name: "Flasks" },
          "2322": { id: "2322", name: "Ice Buckets" },
          "2323": { id: "2323", name: "Liquor Dispensers" },
          "2324": { id: "2324", name: "Wine Bottle Stoppers" },
          "2325": { id: "2325", name: "Wine Boxes" },
          "2326": { id: "2326", name: "Wine Openers & Corkscrews" },
          "2327": { id: "2327", name: "Wine Racks" },
          "2328": { id: "2328", name: "Other Bar & Wine Accessories" }
        }
      },
      "611": {
        id: "611",
        name: "Bedroom Furniture",
        subcategories: {
          "2833": { id: "2833", name: "Bedroom Benches" },
          "2834": { id: "2834", name: "Bedroom Sets" },
          "2835": { id: "2835", name: "Beds" },
          "2836": { id: "2836", name: "Dressers" },
          "2837": { id: "2837", name: "Headboards" },
          "2838": { id: "2838", name: "Mattresses" },
          "2839": { id: "2839", name: "Nightstands" },
          "2840": { id: "2840", name: "Vanities" },
          "2841": { id: "2841", name: "Vanity Stools" },
          "2842": { id: "2842", name: "Wardrobes & Armoires" },
          "2843": { id: "2843", name: "Other Bedroom Furniture" }
        }
      },
      "612": {
        id: "612",
        name: "Kitchen Furniture",
        subcategories: {
          "2407": { id: "2407", name: "Dining Benches" },
          "2408": { id: "2408", name: "Dining Chairs" },
          "2409": { id: "2409", name: "Dining Sets" },
          "2410": { id: "2410", name: "Dining Tables" },
          "2411": { id: "2411", name: "Kitchen Bar Stools" },
          "2412": { id: "2412", name: "Other Dining Furniture" }
        }
      },
      "615": {
        id: "615",
        name: "Home Office Furniture",
        subcategories: {
          "2852": { id: "2852", name: "Bookcases" },
          "2853": { id: "2853", name: "Desks" },
          "2854": { id: "2854", name: "Filing Cabinets" },
          "2855": { id: "2855", name: "Office Cabinets" },
          "2856": { id: "2856", name: "Office Chairs" },
          "2857": { id: "2857", name: "Office Chair Mats" },
          "2858": { id: "2858", name: "Office Shelves" },
          "2859": { id: "2859", name: "Other Home Office Furniture" }
        }
      },
      "616": {
        id: "616",
        name: "Living Room Furniture",
        subcategories: {
          "2860": { id: "2860", name: "Accent Chairs" },
          "2861": { id: "2861", name: "Cabinets" },
          "2862": { id: "2862", name: "Coffee Tables" },
          "2863": { id: "2863", name: "Console Tables" },
          "2864": { id: "2864", name: "Futons" },
          "2865": { id: "2865", name: "Living Room Sets" },
          "2867": { id: "2867", name: "Ottomans" },
          "2868": { id: "2868", name: "Recliners" },
          "2871": { id: "2871", name: "Sofas" },
          "2872": { id: "2872", name: "TV Mounts" },
          "2873": { id: "2873", name: "Other Living Room Furniture" }
        }
      },
      "617": {
        id: "617",
        name: "Bathroom Furniture",
        subcategories: {
          "2826": { id: "2826", name: "Bathroom Cabinets" },
          "2827": { id: "2827", name: "Bathroom Etagere" },
          "2828": { id: "2828", name: "Bathroom Organizers" },
          "2829": { id: "2829", name: "Bathroom Shelves" },
          "2830": { id: "2830", name: "Bathroom Vanities" },
          "2831": { id: "2831", name: "Hampers" },
          "2832": { id: "2832", name: "Other Bathroom Storage" }
        }
      },
      "618": {
        id: "618",
        name: "Other Furniture",
        subcategories: {
          "620": { id: "620", name: "Other Furniture Accessories" }
        }
      },
      "619": {
        id: "619",
        name: "Furniture Hardware & Parts",
        subcategories: {
          "2844": { id: "2844", name: "Backplates" },
          "2845": { id: "2845", name: "Drawer Slides" },
          "2846": { id: "2846", name: "Furniture Legs" },
          "2847": { id: "2847", name: "Hinges" },
          "2848": { id: "2848", name: "Knobs" },
          "2849": { id: "2849", name: "Latches" },
          "2850": { id: "2850", name: "Pulls & Handles" },
          "2851": { id: "2851", name: "Other Furniture Hardware & Parts" }
        }
      },
      "1853": {
        id: "1853",
        name: "Party Supplies",
        subcategories: {
          "1854": { id: "1854", name: "Greeting Cards & Invitations" },
          "1855": { id: "1855", name: "Gift Wrapping Supplies" },
          "1856": { id: "1856", name: "Party Decorations" },
          "1857": { id: "1857", name: "Balloons" },
          "1858": { id: "1858", name: "Party Tableware" },
          "1859": { id: "1859", name: "Piñatas" },
          "1860": { id: "1860", name: "Party Favors" },
          "2244": { id: "2244", name: "Party Hats" },
          "2245": { id: "2245", name: "Party Masks" }
        }
      },
      "2072": {
        id: "2072",
        name: "Kitchen Cutlery",
        subcategories: {
          "2361": { id: "2361", name: "Cheese Knives" },
          "2362": { id: "2362", name: "Chef's Knives" },
          "2363": { id: "2363", name: "Kitchen Boning Knives" },
          "2364": { id: "2364", name: "Kitchen Bread Knives" },
          "2365": { id: "2365", name: "Kitchen Carving Knives" },
          "2366": { id: "2366", name: "Kitchen Cleavers" },
          "2367": { id: "2367", name: "Kitchen Knife Blocks" },
          "2368": { id: "2368", name: "Kitchen Knife Sets" },
          "2369": { id: "2369", name: "Kitchen Knife Sharpeners" },
          "2370": { id: "2370", name: "Kitchen Knife Storage" },
          "2371": { id: "2371", name: "Kitchen Paring Knives" },
          "2372": { id: "2372", name: "Kitchen Scissors & Shears" },
          "2373": { id: "2373", name: "Kitchen Steak Knives" },
          "2374": { id: "2374", name: "Kitchen Utility Knives" },
          "2375": { id: "2375", name: "Nakiri Knives" },
          "2376": { id: "2376", name: "Santoku Knives" }
        }
      },
      "2305": {
        id: "2305",
        name: "Kitchen Baking & Cake Accessories",
        subcategories: {
          "2306": { id: "2306", name: "Cake Boards" },
          "2307": { id: "2307", name: "Cake Candles" },
          "2308": { id: "2308", name: "Cake Levelers" },
          "2309": { id: "2309", name: "Cake Scrapers" },
          "2310": { id: "2310", name: "Cake Toppers" },
          "2311": { id: "2311", name: "Cookie Cutters" },
          "2312": { id: "2312", name: "Icing Bags" },
          "2313": { id: "2313", name: "Icing Nozzles" },
          "2314": { id: "2314", name: "Rolling Pins" }
        }
      },
      "2329": {
        id: "2329",
        name: "Kitchen Barware",
        subcategories: {
          "2330": { id: "2330", name: "Bar Glasses" },
          "2331": { id: "2331", name: "Beer Glasses" },
          "2332": { id: "2332", name: "Champagne Flutes" },
          "2333": { id: "2333", name: "Cocktail Glasses" },
          "2334": { id: "2334", name: "Highball Glasses" },
          "2335": { id: "2335", name: "Margarita Glasses" },
          "2336": { id: "2336", name: "Martini Glasses" },
          "2337": { id: "2337", name: "Old-Fashioned Glasses" },
          "2338": { id: "2338", name: "Shot Glasses" },
          "2339": { id: "2339", name: "Wine Glasses" }
        }
      },
      "2383": {
        id: "2383",
        name: "Kitchen Drinkware",
        subcategories: {
          "2384": { id: "2384", name: "Coffee Mugs" },
          "2385": { id: "2385", name: "Drinking Glasses" },
          "2386": { id: "2386", name: "Glassware Collections" },
          "2387": { id: "2387", name: "Straws" },
          "2388": { id: "2388", name: "Tea Cups" },
          "2389": { id: "2389", name: "Travel Mugs" },
          "2390": { id: "2390", name: "Tumblers" },
          "2391": { id: "2391", name: "Water Bottles" },
          "2392": { id: "2392", name: "Other Drinkware Accessories" }
        }
      },
      "2393": {
        id: "2393",
        name: "Kitchen Flatware",
        subcategories: {
          "2394": { id: "2394", name: "Butter Knives" },
          "2395": { id: "2395", name: "Chopstick Holders" },
          "2396": { id: "2396", name: "Chopsticks" },
          "2397": { id: "2397", name: "Dinner Knives" },
          "2398": { id: "2398", name: "Flatware Sets" },
          "2399": { id: "2399", name: "Forks" },
          "2400": { id: "2400", name: "Pie Servers" },
          "2401": { id: "2401", name: "Salad Servers" },
          "2402": { id: "2402", name: "Serving Forks" },
          "2403": { id: "2403", name: "Serving Sets" },
          "2404": { id: "2404", name: "Serving Spoons" },
          "2405": { id: "2405", name: "Table Spoons" },
          "2406": { id: "2406", name: "Teaspoons" }
        }
      },
      "2413": {
        id: "2413",
        name: "Kitchen Gadgets & Tools",
        subcategories: {
          "2414": { id: "2414", name: "Can Openers" },
          "2415": { id: "2415", name: "Cooking Funnels" },
          "2416": { id: "2416", name: "Cooking Thermometers" },
          "2417": { id: "2417", name: "Garlic Presses" },
          "2418": { id: "2418", name: "Ice Cube Trays" },
          "2419": { id: "2419", name: "Kitchen Cutting Boards" },
          "2420": { id: "2420", name: "Kitchen Mortar & Pestles" },
          "2421": { id: "2421", name: "Kitchen Scales" },
          "2422": { id: "2422", name: "Kitchen Timers" },
          "2423": { id: "2423", name: "Manual Juicers" },
          "2424": { id: "2424", name: "Mixing Bowls" },
          "2425": { id: "2425", name: "Nut & Shell Crackers" },
          "2426": { id: "2426", name: "Oil & Vinegar Dispensers" },
          "2427": { id: "2427", name: "Salt & Pepper Mills" },
          "2428": { id: "2428", name: "Salt & Pepper Shakers" },
          "2429": { id: "2429", name: "Spoon Rests" },
          "2430": { id: "2430", name: "Stove Burner Covers" },
          "2431": { id: "2431", name: "Other Kitchen Gadgets & Tools" }
        }
      },
      "2488": {
        id: "2488",
        name: "Kitchen Tea & Accessories",
        subcategories: {
          "2489": { id: "2489", name: "Electric Kettles" },
          "2490": { id: "2490", name: "Stovetop Kettles" },
          "2491": { id: "2491", name: "Tea Infusers" },
          "2492": { id: "2492", name: "Teapots" }
        }
      }
    }
  },
  "6": { id: "6", name: "Beauty" },
  "3": { id: "3", name: "Kids" },
  "5": { id: "5", name: "Vintage & collectibles" },
  "8": { id: "8", name: "Sports & outdoors" },
  "9": { id: "9", name: "Handmade" },
  "113": { id: "113", name: "Arts & Crafts" },
  "143": { id: "143", name: "Pet Supplies" },
  "2633": { id: "2633", name: "Garden & Outdoor" },
  "2882": { id: "2882", name: "Office" },
  "3170": { id: "3170", name: "Tools" },
  "141": { id: "141", name: "Books" },
  "10": { id: "10", name: "Other" }
};

const MARKETPLACES = [
  { id: "ebay",     label: "eBay",     icon: EBAY_ICON_URL },
  { id: "facebook", label: "Facebook", icon: FACEBOOK_ICON_URL },
  { id: "mercari",  label: "Mercari",  icon: MERCARI_ICON_URL  },
  { id: "etsy",     label: "Etsy",     icon: ETSY_ICON_URL },
  { id: "poshmark", label: "Poshmark", icon: POSHMARK_ICON_URL },
];

const TEMPLATE_DISPLAY_NAMES = {
  general: "General",
  ebay: "eBay",
  etsy: "Etsy",
  mercari: "Mercari",
  facebook: "Facebook Marketplace",
};

const GENERAL_TEMPLATE_DEFAULT = {
  photos: [],
  title: "",
  description: "",
  brand: "",
  condition: "",
  color1: "",
  color2: "",
  color3: "",
  sku: "",
  zip: "",
  tags: "",
  quantity: "1",
  category: "",
  size: "",
  packageDetails: "",
  packageWeight: "",
  packageLength: "",
  packageWidth: "",
  packageHeight: "",
  price: "",
  cost: "",
  customLabels: "",
  categoryId: "",
};

const MARKETPLACE_TEMPLATE_DEFAULTS = {
  ebay: {
    inheritGeneral: true,
    photos: [],
    title: "",
    description: "",
    brand: "",
    color: "",
    categoryId: "",
    categoryName: "",
    itemType: "",
    ebayBrand: "",
    condition: "",
    model: "",
    sku: "",
    itemsIncluded: "",
    customItemSpecifics: {}, // Store any other required item specifics dynamically
    shippingMethod: "",
    shippingCostType: "",
    shippingCost: "",
    handlingTime: "1 business day",
    shipFromCountry: "United States",
    shippingService: "Standard Shipping (3 to 5 business days)",
    locationDescriptions: "",
    shippingLocation: "",
    acceptReturns: false,
    returnWithin: "30 days",
    returnShippingPayer: "Buyer",
    returnRefundMethod: "Full Refund",
    pricingFormat: "fixed",
    duration: "Good 'Til Canceled",
    buyItNowPrice: "",
    allowBestOffer: true,
  },
  etsy: {
    inheritGeneral: true,
    photos: [],
    title: "",
    description: "",
    brand: "",
    sku: "",
    renewalOption: "manual",
    whoMade: "i_did",
    whenMade: "2020s",
    isDigital: false,
    processingTime: "1-3 business days",
    shippingProfile: "",
    tags: "",
  },
  mercari: {
    inheritGeneral: true,
    photos: [],
    title: "",
    description: "",
    brand: "",
    shippingCarrier: "Mercari Prepaid",
    shippingPrice: "",
    localPickup: false,
    smartPricing: false,
    floorPrice: "",
  },
  facebook: {
    inheritGeneral: true,
    photos: [],
    title: "",
    description: "",
    brand: "",
    condition: "",
    size: "",
    itemType: "",
    color: "",
    megapixels: "",
    quantity: "1",
    price: "",
    tags: "",
    sku: "",
    category: "",
    categoryId: "",
    deliveryMethod: "shipping_and_pickup",
    shippingPrice: "",
    localPickup: true,
    meetUpLocation: "",
    allowOffers: true,
    hideFromFriends: false,
  },
};

const createInitialTemplateState = (item) => {
  // If item has a predefined category, clear it so user can select from eBay category picklist
  const itemCategory = item?.category || "";
  const shouldClearCategory = itemCategory && PREDEFINED_CATEGORIES.includes(itemCategory);
  const category = shouldClearCategory ? "" : itemCategory;
  
  // Load all images from inventory item
  let photos = [];
  if (item?.images && Array.isArray(item.images) && item.images.length > 0) {
    // Use the images array if available
    photos = item.images.map((img, index) => ({
      id: `inventory-photo-${index}`,
      preview: img.imageUrl || img.url || img,
      fileName: `Inventory photo ${index + 1}`,
      fromInventory: true
    }));
  } else if (item?.image_url) {
    // Fallback to single image_url if images array not available
    photos = [{ id: "inventory-photo", preview: item.image_url, fileName: "Inventory photo", fromInventory: true }];
  }
  
  const general = {
    ...GENERAL_TEMPLATE_DEFAULT,
    photos: photos,
    title: item?.item_name || "",
    description: item?.notes || "",
    brand: item?.brand || "",
    condition: item?.condition || "",
    color1: item?.color1 || "",
    color2: item?.color2 || "",
    color3: item?.color3 || "",
    sku: item?.sku || "",
    zip: item?.zip_code || "",
    tags: item?.tags || (shouldClearCategory ? "" : item?.category || ""),
    quantity: item?.quantity != null ? String(item.quantity) : "1",
    category: category,
    size: item?.size || "",
    packageDetails: item?.package_details || "",
    packageWeight: item?.package_weight || "",
    packageLength: item?.package_length || "",
    packageWidth: item?.package_width || "",
    packageHeight: item?.package_height || "",
    price: item?.listing_price != null ? String(item.listing_price) : "",
    cost: item?.purchase_price != null ? String(item.purchase_price) : "",
    customLabels: item?.custom_labels || "",
  };

  return {
    general,
    ebay: {
      ...MARKETPLACE_TEMPLATE_DEFAULTS.ebay,
      photos: general.photos || [],
      title: general.title || "",
      description: general.description || "",
      buyItNowPrice: general.price,
      shippingLocation: general.zip,
    },
    etsy: {
      ...MARKETPLACE_TEMPLATE_DEFAULTS.etsy,
      photos: general.photos || [],
      title: general.title || "",
      description: general.description || "",
      tags: general.tags,
    },
    mercari: {
      ...MARKETPLACE_TEMPLATE_DEFAULTS.mercari,
      photos: general.photos || [],
      title: general.title || "",
      description: general.description || "",
      shippingPrice: general.price ? (Number(general.price) >= 100 ? "Free" : "Buyer pays") : "",
    },
    facebook: {
      ...MARKETPLACE_TEMPLATE_DEFAULTS.facebook,
      photos: general.photos || [],
      title: general.title || "",
      description: general.description || "",
      meetUpLocation: general.zip ? `Meet near ${general.zip}` : "",
      shippingPrice: general.price ? (Number(general.price) >= 75 ? "Free shipping" : "") : "",
    },
  };
};

const renderMarketplaceIcon = (marketplace, sizeClass = "w-4 h-4") => {
  if (typeof marketplace.icon === "string" && marketplace.icon.startsWith("http")) {
    return (
      <img
        src={marketplace.icon}
        alt={`${marketplace.label} icon`}
        className={`${sizeClass} object-contain`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center ${sizeClass} text-xs leading-none`}
    >
      {marketplace.icon}
    </span>
  );
};

const POPULAR_BRANDS = [
  "Adidas", "Alo Yoga", "Apple", "Arc'teryx", "ASICS", "Athleta",
  "Beats", "Bose", "Brooks", "Burberry",
  "Calvin Klein", "Carhartt", "Chanel", "Coach", "Columbia", "Converse",
  "Dickies", "Dyson",
  "Fabletics", "Fila", "Forever 21",
  "Gap", "Gucci", "Gymshark",
  "Hasbro", "H&M", "Hugo Boss", "Hydro Flask",
  "Instant Pot",
  "JBL", "Jordan",
  "Kate Spade", "KitchenAid",
  "Lego", "Levi's", "Louis Vuitton", "Lululemon",
  "Mattel", "Michael Kors",
  "New Balance", "Nike", "Ninja", "Nintendo",
  "Patagonia", "Prada", "Puma",
  "Ralph Lauren", "REI", "Reebok",
  "Samsung", "Sony", "Stanley",
  "The North Face", "Tommy Hilfiger", "Tory Burch",
  "Under Armour", "Uniqlo",
  "Vans", "Versace",
  "Wrangler",
  "Yeti",
  "Zara",
];

const COMMON_COLORS = [
  { name: "Black", hex: "#000000" },
  { name: "Beige", hex: "#F5F5DC" },
  { name: "Blue", hex: "#0000FF" },
  { name: "Brown", hex: "#8B4513" },
  { name: "Gold", hex: "#FFD700" },
  { name: "Grey", hex: "#808080" },
  { name: "Green", hex: "#008000" },
  { name: "Orange", hex: "#FFA500" },
  { name: "Pink", hex: "#FFC0CB" },
  { name: "Purple", hex: "#800080" },
  { name: "Red", hex: "#FF0000" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "Yellow", hex: "#FFFF00" },
  { name: "White", hex: "#FFFFFF" },
];

const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany", "France",
  "Italy", "Spain", "Netherlands", "Belgium", "Switzerland", "Austria",
  "Sweden", "Norway", "Denmark", "Finland", "Ireland", "Portugal",
  "Poland", "Czech Republic", "Hungary", "Romania", "Greece", "Japan",
  "China", "South Korea", "India", "Singapore", "Hong Kong", "Taiwan",
  "New Zealand", "Mexico", "Brazil", "Argentina", "Chile", "South Africa",
  "Israel", "United Arab Emirates", "Saudi Arabia", "Turkey", "Russia",
  "Ukraine", "Other"
];

export default function CrosslistComposer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addTag } = useInventoryTags();
  
  // Get item IDs and autoSelect from URL
  const searchParams = new URLSearchParams(location.search);
  const idsParam = searchParams.get('ids');
  const autoSelectParam = searchParams.get('autoSelect');
  const itemIds = idsParam ? idsParam.split(',').filter(Boolean) : [];
  const autoSelect = autoSelectParam !== 'false';
  
  // Fetch inventory items if IDs are provided
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventoryItems"],
    queryFn: () => base44.entities.InventoryItem.list("-purchase_date"),
    initialData: [],
  });
  
  const bulkSelectedItems = useMemo(() => {
    if (itemIds.length === 0) return [];
    return inventory.filter(item => itemIds.includes(item.id));
  }, [inventory, itemIds]);
  
  const [templateForms, setTemplateForms] = useState(() => createInitialTemplateState(null));
  const [activeForm, setActiveForm] = useState("general");
  const [isSaving, setIsSaving] = useState(false);
  const [currentEditingItemId, setCurrentEditingItemId] = useState(null);
  const [packageDetailsDialogOpen, setPackageDetailsDialogOpen] = useState(false);
  const [brandIsCustom, setBrandIsCustom] = useState(false);
  const [customBrands, setCustomBrands] = useState(() => {
    try {
      const saved = localStorage.getItem('customBrands');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showFacebookMoreDetails, setShowFacebookMoreDetails] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [editingColorField, setEditingColorField] = useState(null);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState([]);
  const [generalCategoryPath, setGeneralCategoryPath] = useState([]);
  const [mercariCategoryPath, setMercariCategoryPath] = useState([]);
  const [descriptionGeneratorOpen, setDescriptionGeneratorOpen] = useState(false);
  const [brandSearchOpen, setBrandSearchOpen] = useState(false);
  const [categorySearchOpen, setCategorySearchOpen] = useState(false);
  const photoInputRef = React.useRef(null);
  const ebayPhotoInputRef = React.useRef(null);
  const etsyPhotoInputRef = React.useRef(null);
  const mercariPhotoInputRef = React.useRef(null);
  const facebookPhotoInputRef = React.useRef(null);
  const [soldDialogOpen, setSoldDialogOpen] = useState(false);
  const [ebaySearchDialogOpen, setEbaySearchDialogOpen] = useState(false);
  const [ebaySearchInitialQuery, setEbaySearchInitialQuery] = useState("");
  
  // eBay OAuth token state
  const [ebayToken, setEbayToken] = useState(() => {
    // Load token from localStorage on mount
    try {
      const stored = localStorage.getItem('ebay_user_token');
      if (stored) {
        const tokenData = JSON.parse(stored);
        // Check if token is expired
        if (tokenData.expires_at && tokenData.expires_at > Date.now()) {
          return tokenData;
        }
        // Token expired, remove it
        localStorage.removeItem('ebay_user_token');
      }
    } catch (e) {
      console.error('Error loading eBay token:', e);
    }
    return null;
  });

  // eBay username state
  const [ebayUsername, setEbayUsername] = useState(() => {
    // Load username from localStorage on mount
    try {
      const stored = localStorage.getItem('ebay_username');
      if (stored) {
        return stored;
      }
    } catch (e) {
      console.error('Error loading eBay username:', e);
    }
    return null;
  });
  
  // eBay listing ID state
  const [ebayListingId, setEbayListingId] = useState(null);

  // Facebook OAuth token state
  const [facebookToken, setFacebookToken] = useState(() => {
    // Load token from localStorage on mount
    try {
      const stored = localStorage.getItem('facebook_access_token');
      if (stored) {
        const tokenData = JSON.parse(stored);
        // Check if token is expired
        if (tokenData.expires_at && tokenData.expires_at > Date.now()) {
          return tokenData;
        }
        // Token expired, remove it
        localStorage.removeItem('facebook_access_token');
      }
    } catch (e) {
      console.error('Error loading Facebook token:', e);
    }
    return null;
  });

  // Facebook pages state
  const [facebookPages, setFacebookPages] = useState([]);
  const [facebookSelectedPage, setFacebookSelectedPage] = useState(null);
  
  // Image Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [imageToEdit, setImageToEdit] = useState({ url: null, photoId: null, marketplace: null, index: null });
  
  // Load listing ID when currentEditingItemId changes
  useEffect(() => {
    if (currentEditingItemId) {
      const stored = localStorage.getItem(`ebay_listing_${currentEditingItemId}`);
      if (stored) {
        setEbayListingId(stored);
      } else {
        // Check inventory item for listing ID
        const inventoryItem = inventory.find(item => item.id === currentEditingItemId);
        if (inventoryItem?.ebay_listing_id) {
          localStorage.setItem(`ebay_listing_${currentEditingItemId}`, inventoryItem.ebay_listing_id);
          setEbayListingId(inventoryItem.ebay_listing_id);
        } else {
          setEbayListingId(null);
        }
      }
    } else {
      setEbayListingId(null);
    }
  }, [currentEditingItemId, inventory]);
  
  // Handle OAuth callback from URL params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    
    // Check for OAuth success
    if (params.get('ebay_auth_success') === '1') {
      const tokenParam = params.get('token');
      if (tokenParam) {
        try {
          const tokenData = JSON.parse(decodeURIComponent(tokenParam));
          const expiresAt = Date.now() + (tokenData.expires_in * 1000);
          
          const tokenToStore = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt,
            expires_in: tokenData.expires_in,
            refresh_token_expires_in: tokenData.refresh_token_expires_in,
            token_type: tokenData.token_type,
          };
          
          // Restore theme IMMEDIATELY before any other operations
          const preservedTheme = sessionStorage.getItem('preserved_theme');
          if (preservedTheme) {
            // Restore theme to localStorage immediately
            localStorage.setItem('theme', preservedTheme);
            // Update DOM immediately
            const root = document.documentElement;
            root.setAttribute('data-theme', preservedTheme);
            // Trigger theme update
            window.dispatchEvent(new Event('storage'));
            // Clean up sessionStorage
            sessionStorage.removeItem('preserved_theme');
          }
          
          // Store token securely
          localStorage.setItem('ebay_user_token', JSON.stringify(tokenToStore));
          setEbayToken(tokenToStore);
          
          // Fetch username after token is stored
          // This will be done in a separate useEffect
          
          // Restore saved form state
          const savedState = sessionStorage.getItem('ebay_oauth_state');
          if (savedState) {
            try {
              const stateData = JSON.parse(savedState);
              // Restore form state
              if (stateData.templateForms) {
                setTemplateForms(stateData.templateForms);
              }
              if (stateData.currentEditingItemId) {
                setCurrentEditingItemId(stateData.currentEditingItemId);
                // Reload item data if we have an item ID and it exists in inventory
                if (stateData.itemIds) {
                  const itemIdsArray = stateData.itemIds.split(',').filter(Boolean);
                  if (itemIdsArray.length > 0) {
                    // Update URL to include item IDs so the page knows which items to show
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('ids', stateData.itemIds);
                    if (stateData.autoSelect !== undefined) {
                      newUrl.searchParams.set('autoSelect', String(stateData.autoSelect));
                    }
                    
                    // Use navigate instead of reload to preserve theme and other preferences
                    navigate(newUrl.pathname + newUrl.search, { replace: true });
                    
                    // Don't reload - let React handle the state restoration
                    return; // Exit early
                  }
                }
              }
              if (stateData.activeForm) {
                setActiveForm(stateData.activeForm);
              }
              if (stateData.selectedCategoryPath) {
                setSelectedCategoryPath(stateData.selectedCategoryPath);
              }
              if (stateData.generalCategoryPath) {
                setGeneralCategoryPath(stateData.generalCategoryPath);
              }
              
              // Clear saved state
              sessionStorage.removeItem('ebay_oauth_state');
            } catch (e) {
              console.error('Error restoring saved state:', e);
            }
          }
          
          toast({
            title: "eBay account connected!",
            description: "Your eBay account has been successfully connected.",
          });
          
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
        } catch (e) {
          console.error('Error parsing token:', e);
          toast({
            title: "Connection error",
            description: "Failed to save eBay connection. Please try again.",
            variant: "destructive",
          });
        }
      }
    }
    
    // Check for OAuth errors
    const authError = params.get('ebay_auth_error');
    if (authError) {
      const errorMessage = decodeURIComponent(authError);
      let helpText = errorMessage;
      
      // Provide helpful guidance for common errors
      if (errorMessage.includes('invalid_request') || errorMessage.includes('redirect_uri')) {
        helpText = 'The redirect URL doesn\'t match your eBay Developer Console settings. Please check:\n\n' +
                   '1. Go to developer.ebay.com/my/keys\n' +
                   '2. Verify OAuth 2.0 Redirect URIs match your app URL\n' +
                   '3. Make sure you\'re using the correct environment (Sandbox vs Production)\n\n' +
                   'Open browser console for detailed configuration info.';
      }
      
      toast({
        title: "eBay Connection Failed",
        description: helpText,
        variant: "destructive",
        duration: 10000, // Show longer for complex messages
      });
      
      console.error('eBay OAuth Error Details:', {
        error: errorMessage,
        currentUrl: window.location.href,
        suggestion: 'Visit /api/ebay/auth?debug=true to see your OAuth configuration'
      });
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Handle Facebook OAuth callback
    if (params.get('facebook_auth_success') === '1') {
      const tokenParam = params.get('token');
      if (tokenParam) {
        try {
          const tokenData = JSON.parse(decodeURIComponent(tokenParam));
          
          const tokenToStore = {
            access_token: tokenData.access_token,
            expires_at: tokenData.expires_at || (Date.now() + (tokenData.expires_in * 1000)),
            expires_in: tokenData.expires_in,
            token_type: tokenData.token_type || 'bearer',
          };
          
          // Restore theme IMMEDIATELY before any other operations
          const preservedTheme = sessionStorage.getItem('preserved_theme');
          if (preservedTheme) {
            // Restore theme to localStorage immediately
            localStorage.setItem('theme', preservedTheme);
            // Update DOM immediately
            const root = document.documentElement;
            root.setAttribute('data-theme', preservedTheme);
            // Trigger theme update
            window.dispatchEvent(new Event('storage'));
            // Clean up sessionStorage
            sessionStorage.removeItem('preserved_theme');
          }
          
          // Store token securely
          localStorage.setItem('facebook_access_token', JSON.stringify(tokenToStore));
          setFacebookToken(tokenToStore);
          
          // Fetch pages after token is stored
          // This will be done in a separate useEffect
          
          // Restore saved form state
          const savedState = sessionStorage.getItem('facebook_oauth_state');
          if (savedState) {
            try {
              const stateData = JSON.parse(savedState);
              // Restore form state
              if (stateData.templateForms) {
                setTemplateForms(stateData.templateForms);
              }
              if (stateData.currentEditingItemId) {
                setCurrentEditingItemId(stateData.currentEditingItemId);
                // Reload item data if we have an item ID and it exists in inventory
                if (stateData.itemIds) {
                  const itemIdsArray = stateData.itemIds.split(',').filter(Boolean);
                  if (itemIdsArray.length > 0) {
                    // Update URL to include item IDs so the page knows which items to show
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('ids', stateData.itemIds);
                    if (stateData.autoSelect !== undefined) {
                      newUrl.searchParams.set('autoSelect', String(stateData.autoSelect));
                    }
                    
                    // Use navigate instead of reload to preserve theme and other preferences
                    navigate(newUrl.pathname + newUrl.search, { replace: true });
                    
                    // Don't reload - let React handle the state restoration
                    return; // Exit early
                  }
                }
              }
              if (stateData.activeForm) {
                setActiveForm(stateData.activeForm);
              }
              if (stateData.selectedCategoryPath) {
                setSelectedCategoryPath(stateData.selectedCategoryPath);
              }
              if (stateData.generalCategoryPath) {
                setGeneralCategoryPath(stateData.generalCategoryPath);
              }
              
              // Clear saved state
              sessionStorage.removeItem('facebook_oauth_state');
            } catch (e) {
              console.error('Error restoring saved state:', e);
            }
          }
          
          toast({
            title: "Facebook account connected!",
            description: "Your Facebook account has been successfully connected.",
          });
          
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
        } catch (e) {
          console.error('Error parsing Facebook token:', e);
          toast({
            title: "Connection error",
            description: "Failed to save Facebook connection. Please try again.",
            variant: "destructive",
          });
        }
      }
    }
    
    // Check for Facebook OAuth errors
    const facebookAuthError = params.get('facebook_auth_error');
    if (facebookAuthError) {
      const errorMsg = decodeURIComponent(facebookAuthError);
      console.error('Facebook OAuth error:', errorMsg);
      
      let description = errorMsg;
      if (errorMsg.includes('redirect_uri')) {
        description = `${errorMsg}\n\nQuick Fix: Visit /api/facebook/debug to see your redirect URI, then add it to Facebook App Settings > Valid OAuth Redirect URIs`;
      }
      
      toast({
        title: "Facebook Connection Failed",
        description: description,
        variant: "destructive",
        duration: 10000,
      });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location, toast, navigate]);

  // Fetch Facebook pages when token is available
  useEffect(() => {
    let isMounted = true;
    
    const fetchFacebookPages = async () => {
      if (facebookToken?.access_token) {
        try {
          // Check if token is expired
          if (facebookToken.expires_at && facebookToken.expires_at <= Date.now()) {
            console.warn('Facebook token expired, cannot fetch pages');
            return;
          }

          // Import Facebook client functions
          const { getUserPages } = await import('@/api/facebookClient');
          const pages = await getUserPages();
          
          if (isMounted) {
            setFacebookPages(pages);
            
            // Auto-select first page if available and none selected
            if (pages.length > 0) {
              setFacebookSelectedPage(prev => prev || pages[0]);
            }
          }
        } catch (error) {
          console.error('Error fetching Facebook pages:', error);
          // Don't show error toast here, let the user see it in the UI
        }
      } else {
        // Clear pages if token is removed
        if (isMounted) {
          setFacebookPages([]);
          setFacebookSelectedPage(null);
        }
      }
    };

    fetchFacebookPages();
    
    return () => {
      isMounted = false;
    };
  }, [facebookToken]);

  // Fetch eBay username when token is available
  useEffect(() => {
    const fetchEbayUsername = async () => {
      if (ebayToken?.access_token && !ebayUsername) {
        try {
          // Check if token is expired
          if (ebayToken.expires_at && ebayToken.expires_at <= Date.now()) {
            console.warn('eBay token expired, cannot fetch username');
            return;
          }

          const response = await fetch('/api/ebay/listing', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              operation: 'GetUser',
              userToken: ebayToken.access_token,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            const username = result.User?.UserID;
            if (username) {
              setEbayUsername(username);
              localStorage.setItem('ebay_username', username);
            }
          } else {
            console.error('Failed to fetch eBay username:', response.status);
          }
        } catch (error) {
          console.error('Error fetching eBay username:', error);
        }
      }
    };

    fetchEbayUsername();
  }, [ebayToken, ebayUsername]);
  
  // Get eBay category tree ID
  const { data: categoryTreeData, isLoading: isLoadingCategoryTree, error: categoryTreeError } = useEbayCategoryTreeId('EBAY_US');
  // Extract category tree ID - check multiple possible response structures
  const categoryTreeId = categoryTreeData?.categoryTreeId || categoryTreeData?.category_tree_id || categoryTreeData?.categoryTree?.categoryTreeId || null;
  
  // Debug logging for category tree ID
  useEffect(() => {
    if (!isLoadingCategoryTree) {
      console.log('🔍 Category Tree ID Debug:', {
        isLoadingCategoryTree,
        categoryTreeData,
        categoryTreeId,
        categoryTreeError,
        extractedFrom: {
          categoryTreeId: categoryTreeData?.categoryTreeId,
          category_tree_id: categoryTreeData?.category_tree_id,
          categoryTree_categoryTreeId: categoryTreeData?.categoryTree?.categoryTreeId,
        },
      });
      
      if (categoryTreeError) {
        console.error('❌ Error loading category tree ID:', categoryTreeError);
      } else if (!categoryTreeId) {
        console.warn('⚠️ Category tree ID not found. Full response:', categoryTreeData);
      } else {
        // Note: "0" might be a valid category tree ID for US marketplace!
        console.log('✅ Category tree ID:', categoryTreeId, typeof categoryTreeId);
      }
    }
  }, [categoryTreeId, categoryTreeData, isLoadingCategoryTree, categoryTreeError]);
  
  // Get the current level of categories based on selected path for eBay form
  const ebayCurrentCategoryId = selectedCategoryPath.length > 0 
    ? selectedCategoryPath[selectedCategoryPath.length - 1].categoryId 
    : '0';
  
  // Get the current level of categories based on selected path for General form
  const generalCurrentCategoryId = generalCategoryPath.length > 0 
    ? generalCategoryPath[generalCategoryPath.length - 1].categoryId 
    : '0';
  
  // Categories for eBay form
  const { data: ebayCategoriesData, isLoading: isLoadingEbayCategories, error: ebayCategoriesError } = useEbayCategories(
    categoryTreeId,
    ebayCurrentCategoryId,
    activeForm === "ebay" && !!categoryTreeId
  );
  
  // Categories for General form
  const { data: generalCategoriesData, isLoading: isLoadingGeneralCategories, error: generalCategoriesError } = useEbayCategories(
    categoryTreeId,
    generalCurrentCategoryId,
    (activeForm === "general" || activeForm === "facebook" || activeForm === "mercari") && !!categoryTreeId
  );
  
  // Use the appropriate category data based on active form
  // Facebook and Mercari forms use General category data for consistency
  const categoriesData = (activeForm === "general" || activeForm === "facebook" || activeForm === "mercari") ? generalCategoriesData : ebayCategoriesData;
  const isLoadingCategories = (activeForm === "general" || activeForm === "facebook" || activeForm === "mercari") ? isLoadingGeneralCategories : isLoadingEbayCategories;
  const categoriesError = (activeForm === "general" || activeForm === "facebook" || activeForm === "mercari") ? generalCategoriesError : ebayCategoriesError;
  const currentCategoryPath = (activeForm === "general" || activeForm === "facebook" || activeForm === "mercari") ? generalCategoryPath : selectedCategoryPath;
  
  const categorySubtreeNode = categoriesData?.categorySubtreeNode;
  const currentCategories = categorySubtreeNode?.childCategoryTreeNodes || [];

  // Sort categories alphabetically
  const sortedCategories = [...currentCategories].sort((a, b) => {
    const nameA = a.category?.categoryName || '';
    const nameB = b.category?.categoryName || '';
    return nameA.localeCompare(nameB);
  });

  // eBay shipping defaults storage
  const EBAY_DEFAULTS_KEY = 'ebay-shipping-defaults';
  const loadEbayDefaults = () => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(EBAY_DEFAULTS_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      console.warn('Failed to load eBay defaults:', error);
      return null;
    }
  };

  const saveEbayDefaults = (defaults) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(EBAY_DEFAULTS_KEY, JSON.stringify(defaults));
      toast({
        title: "Defaults saved",
        description: "Your shipping defaults have been saved and will be applied to new listings.",
      });
    } catch (error) {
      console.warn('Failed to save eBay defaults:', error);
      toast({
        title: "Error",
        description: "Failed to save defaults. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Load defaults on mount
  useEffect(() => {
    const defaults = loadEbayDefaults();
    if (defaults) {
      setTemplateForms((prev) => ({
        ...prev,
        ebay: {
          ...prev.ebay,
          ...defaults,
        },
      }));
    }
  }, []);
  
  const populateTemplates = React.useCallback((item) => {
    const itemId = item?.id;
    
    // First, load any saved form data for this item
    const savedGeneral = loadTemplateFromStorage('general', itemId);
    const savedEbay = loadTemplateFromStorage('ebay', itemId);
    const savedEtsy = loadTemplateFromStorage('etsy', itemId);
    const savedMercari = loadTemplateFromStorage('mercari', itemId);
    const savedFacebook = loadTemplateFromStorage('facebook', itemId);
    
    // Start with initial template state from item
    const initial = createInitialTemplateState(item);
    
    // Merge with saved form data (saved data takes precedence over initial state)
    const merged = {
      general: savedGeneral ? { ...initial.general, ...savedGeneral } : initial.general,
      ebay: savedEbay ? { ...initial.ebay, ...savedEbay } : initial.ebay,
      etsy: savedEtsy ? { ...initial.etsy, ...savedEtsy } : initial.etsy,
      mercari: savedMercari ? { ...initial.mercari, ...savedMercari } : initial.mercari,
      facebook: savedFacebook ? { ...initial.facebook, ...savedFacebook } : initial.facebook,
    };
    
    setTemplateForms(merged);
    setActiveForm("general");
    setSelectedCategoryPath([]);
    setGeneralCategoryPath([]);
    const brand = item?.brand || "";
    if (brand && !POPULAR_BRANDS.includes(brand)) {
      setBrandIsCustom(true);
    } else {
      setBrandIsCustom(false);
    }
  }, []);
  
  // Load saved templates from localStorage - per-item if editing, global templates for new items
  // Note: This runs when item ID changes, but populateTemplates also loads saved data
  // So we'll only use this for cases where we switch items without calling populateTemplates
  useEffect(() => {
    const itemId = currentEditingItemId;
    
    // Skip if we don't have an item ID (new item mode will use global templates via different mechanism)
    if (!itemId) {
      // For new items, load global templates only on initial mount
      if (bulkSelectedItems.length === 0) {
        const savedGeneral = loadTemplateFromStorage('general', null);
        const savedEbay = loadTemplateFromStorage('ebay', null);
        const savedEtsy = loadTemplateFromStorage('etsy', null);
        const savedMercari = loadTemplateFromStorage('mercari', null);
        const savedFacebook = loadTemplateFromStorage('facebook', null);
        
        if (savedGeneral || savedEbay || savedEtsy || savedMercari || savedFacebook) {
          setTemplateForms((prev) => {
            const updated = { ...prev };
            if (savedGeneral) updated.general = { ...prev.general, ...savedGeneral };
            if (savedEbay) updated.ebay = { ...prev.ebay, ...savedEbay };
            if (savedEtsy) updated.etsy = { ...prev.etsy, ...savedEtsy };
            if (savedMercari) updated.mercari = { ...prev.mercari, ...savedMercari };
            if (savedFacebook) updated.facebook = { ...prev.facebook, ...savedFacebook };
            return updated;
          });
        }
      }
      return;
    }
    
    // For existing items, populateTemplates already loads saved data
    // So we don't need to do anything here - populateTemplates handles it
    // This useEffect is mainly for the initial mount case
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEditingItemId, bulkSelectedItems.length]); // Reload when item ID changes
  
  // Initialize template from first item if available
  useEffect(() => {
    if (bulkSelectedItems.length > 0) {
      const primaryItem = bulkSelectedItems[0];
      if (autoSelect) {
        // Auto-select the first item and populate templates
        setCurrentEditingItemId(primaryItem.id);
        populateTemplates(primaryItem);
      } else {
        // Don't auto-select, just set current editing item but don't populate
        setCurrentEditingItemId(primaryItem.id);
        setTemplateForms(createInitialTemplateState(null));
        setBrandIsCustom(false);
        setSelectedCategoryPath([]);
        setGeneralCategoryPath([]);
      }
    } else {
      // New item mode - no items selected
      setCurrentEditingItemId(null);
      setTemplateForms(createInitialTemplateState(null));
      setBrandIsCustom(false);
      setSelectedCategoryPath([]);
      setGeneralCategoryPath([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkSelectedItems.length, autoSelect, itemIds.join(',')]);
  
  const switchToItem = (itemId) => {
    const item = bulkSelectedItems.find(it => it.id === itemId);
    if (item) {
      setCurrentEditingItemId(itemId);
      populateTemplates(item);
      setActiveForm("general");
      setSelectedCategoryPath([]);
      setGeneralCategoryPath([]);
    }
  };
  
  const generalForm = templateForms.general;
  const ebayForm = templateForms.ebay;
  const etsyForm = templateForms.etsy;
  const mercariForm = templateForms.mercari;
  const facebookForm = templateForms.facebook;

  // Find similar items for description generation
  const similarItems = useMemo(() => {
    if (!generalForm.title && !generalForm.brand && !generalForm.category) {
      return [];
    }

    return inventory
      .filter(item => {
        // Exclude current item if editing
        if (currentEditingItemId && item.id === currentEditingItemId) {
          return false;
        }

        // Find items with similar characteristics
        const titleMatch = generalForm.title && item.item_name
          ? item.item_name.toLowerCase().includes(generalForm.title.toLowerCase().split(' ')[0]) ||
            generalForm.title.toLowerCase().includes(item.item_name.toLowerCase().split(' ')[0])
          : false;

        const brandMatch = generalForm.brand && item.brand
          ? item.brand.toLowerCase() === generalForm.brand.toLowerCase()
          : false;

        const categoryMatch = generalForm.category && item.category
          ? item.category.toLowerCase() === generalForm.category.toLowerCase()
          : false;

        return (titleMatch || brandMatch || categoryMatch) && item.notes && item.notes.trim().length > 0;
      })
      .slice(0, 10) // Limit to 10 similar items
      .map(item => item.notes)
      .filter(Boolean);
  }, [inventory, generalForm.title, generalForm.brand, generalForm.category, currentEditingItemId]);

  // Get category aspects (brands, types, etc.) when a final category is selected
  // For eBay form
  // Note: categoryTreeId can be '0' for US marketplace, so only check for null/undefined/loading
  const isValidCategoryTreeId = !isLoadingCategoryTree && categoryTreeId !== null && categoryTreeId !== undefined && String(categoryTreeId).trim() !== '';
  const isValidEbayCategoryId = ebayForm.categoryId && ebayForm.categoryId !== '0' && ebayForm.categoryId !== 0 && String(ebayForm.categoryId).trim() !== '';
  
  // Log debugging info for aspect fetching (only log when values actually change)
  useEffect(() => {
    if (ebayForm.categoryId && !isLoadingCategoryTree) {
      const validTreeId = categoryTreeId !== null && categoryTreeId !== undefined && String(categoryTreeId).trim() !== '';
      const validCategoryId = ebayForm.categoryId && ebayForm.categoryId !== '0' && ebayForm.categoryId !== 0 && String(ebayForm.categoryId).trim() !== '';
      const willFetch = validTreeId && validCategoryId;
      
      console.log('🔍 Aspect fetch check:', {
        isLoadingCategoryTree,
        categoryTreeId,
        categoryId: ebayForm.categoryId,
        isValidCategoryTreeId: validTreeId,
        isValidEbayCategoryId: validCategoryId,
        willFetch,
      });
    }
  }, [isLoadingCategoryTree, categoryTreeId, ebayForm.categoryId]); // Removed computed values from deps
  
  // Fetch aspects whenever a category is selected (not just when form is active)
  // This ensures aspects are loaded and ready when user switches to eBay form
  const { data: ebayCategoryAspectsData, isLoading: isLoadingEbayAspects, error: ebayAspectsError } = useEbayCategoryAspects(
    categoryTreeId || null, // Pass null if invalid to prevent API call
    ebayForm.categoryId,
    !!(isValidCategoryTreeId && isValidEbayCategoryId) // Convert to strict boolean
  );

  // For General form - fetch aspects if categoryId is available
  const isValidGeneralCategoryId = generalForm.categoryId && generalForm.categoryId !== '0' && generalForm.categoryId !== 0 && String(generalForm.categoryId).trim() !== '';
  const { data: generalCategoryAspectsData } = useEbayCategoryAspects(
    categoryTreeId,
    generalForm.categoryId,
    !!((activeForm === "general" || activeForm === "etsy" || activeForm === "mercari" || activeForm === "facebook") && isValidCategoryTreeId && isValidGeneralCategoryId) // Convert to strict boolean
  );

  // Use appropriate aspects data based on active form
  const categoryAspects = activeForm === "ebay" 
    ? (ebayCategoryAspectsData?.aspects || [])
    : (generalCategoryAspectsData?.aspects || []);

  // eBay-specific aspects (always use eBay aspects for eBay Category Specifics section)
  // Handle different possible response structures
  const ebayCategoryAspects = (
    ebayCategoryAspectsData?.aspects || 
    ebayCategoryAspectsData?.aspectsForCategory || 
    ebayCategoryAspectsData?.categoryAspects ||
    ebayCategoryAspectsData?.data?.aspects ||
    (Array.isArray(ebayCategoryAspectsData) ? ebayCategoryAspectsData : [])
  ) || [];
  
  // eBay-specific aspect detection
  const ebayBrandAspect = ebayCategoryAspects.find(aspect => 
    aspect.localizedAspectName?.toLowerCase() === 'brand' ||
    aspect.aspectConstraint?.aspectDataType === 'STRING'
  );
  
  // Find Type/Model aspect for eBay - check for various naming patterns
  // eBay can return "Model", "Type", "Model (Type)", "Console Model", etc.
  const ebayTypeAspect = ebayCategoryAspects.find(aspect => {
    // Check multiple possible fields for aspect name
    const aspectName = (
      aspect.localizedAspectName?.toLowerCase() || 
      aspect.aspectName?.toLowerCase() ||
      aspect.name?.toLowerCase() ||
      ''
    ).trim();
    
    if (!aspectName) return false;
    
    // Check for exact matches first (highest priority)
    if (aspectName === 'type' || aspectName === 'model') {
      return true;
    }
    
    // Check for combined names with parentheses
    if (aspectName === 'model (type)' || aspectName === 'type (model)') {
      return true;
    }
    
    // Check if it contains "model" (case-insensitive) - this catches "Console Model", "Video Game Console Model", etc.
    if (aspectName.includes('model')) {
      return true;
    }
    
    // Check if it contains "type" but NOT "model" (to avoid duplicates)
    // This catches categories that only have "Type" aspect
    if (aspectName.includes('type') && !aspectName.includes('model')) {
      return true;
    }
    
    return false;
  });

  // General form aspects (for active form display)
  const brandAspect = categoryAspects.find(aspect => 
    aspect.localizedAspectName?.toLowerCase() === 'brand' ||
    aspect.aspectConstraint?.aspectDataType === 'STRING'
  );
  
  // Find Type/Model aspect - check for various naming patterns
  // eBay can return "Model", "Type", "Model (Type)", etc.
  const typeAspect = categoryAspects.find(aspect => {
    const aspectName = aspect.localizedAspectName?.toLowerCase() || '';
    // Check for exact matches first
    if (aspectName === 'type' || aspectName === 'model') {
      return true;
    }
    // Check for combined names
    if (aspectName.includes('type') && aspectName.includes('model')) {
      return true;
    }
    // Check for variations with parentheses
    if (aspectName === 'model (type)' || aspectName === 'type (model)') {
      return true;
    }
    // Check if it contains "model" (case-insensitive)
    if (aspectName.includes('model')) {
      return true;
    }
    return false;
  });
  
  // Debug logging (remove in production if needed)
  if (ebayForm.categoryId) {
    console.log('eBay Category Aspects Debug:', {
      categoryId: ebayForm.categoryId,
      categoryName: ebayForm.categoryName,
      aspectCount: ebayCategoryAspects.length,
      aspectNames: ebayCategoryAspects.map(a => ({
        localizedAspectName: a.localizedAspectName,
        aspectName: a.aspectName,
        name: a.name,
        fullAspect: a
      })),
      foundTypeAspect: !!ebayTypeAspect,
      typeAspectName: ebayTypeAspect?.localizedAspectName || ebayTypeAspect?.aspectName || ebayTypeAspect?.name,
      typeAspectValues: ebayTypeAspect?.aspectValues?.length || 0,
      typeAspectFull: ebayTypeAspect,
      allAspectsFull: ebayCategoryAspects,
    });
  }
  
  // Check if Type aspect is required or recommended (for eBay)
  const isEbayTypeRequired = ebayTypeAspect?.aspectConstraint?.aspectMode === 'REQUIRED' || 
                             ebayTypeAspect?.aspectConstraint?.aspectMode === 'RECOMMENDED';
  
  // Check if Type aspect is required or recommended (for general form)
  const isTypeRequired = typeAspect?.aspectConstraint?.aspectMode === 'REQUIRED' || 
                         typeAspect?.aspectConstraint?.aspectMode === 'RECOMMENDED';
  
  // Check if category has size-related aspects (use eBay aspects for eBay form)
  const ebaySizeAspect = ebayCategoryAspects.find(aspect => {
    const aspectName = aspect.localizedAspectName?.toLowerCase() || '';
    return aspectName.includes('size') || 
           aspectName.includes('shirt size') || 
           aspectName.includes('shoe size') ||
           aspectName.includes('clothing size') ||
           aspectName.includes('apparel size') ||
           aspectName === 'us size' ||
           aspectName === 'size type';
  });
  
  const sizeAspect = categoryAspects.find(aspect => {
    const aspectName = aspect.localizedAspectName?.toLowerCase() || '';
    return aspectName.includes('size') || 
           aspectName.includes('shirt size') || 
           aspectName.includes('shoe size') ||
           aspectName.includes('clothing size') ||
           aspectName.includes('apparel size') ||
           aspectName === 'us size' ||
           aspectName === 'size type';
  });
  const hasSizeAspect = !!sizeAspect;
  const hasEbaySizeAspect = !!ebaySizeAspect;

  // Find all REQUIRED aspects for eBay (not just Model/Type)
  const ebayRequiredAspects = ebayCategoryAspects.filter(aspect => {
    const constraint = aspect.aspectConstraint;
    const isRequired = constraint?.aspectMode === 'REQUIRED' || constraint?.aspectMode === 'RECOMMENDED';
    // Exclude Brand, Model/Type, Items Included, and blockchain/NFT fields (handled separately or not applicable)
    const aspectName = (aspect.localizedAspectName || aspect.aspectName || aspect.name || '').toLowerCase();
    const isBrand = aspectName === 'brand';
    const isModelOrType = aspectName.includes('model') || aspectName === 'type';
    const isItemsIncluded = aspectName.includes('items included') || aspectName.includes('what\'s included') || aspectName === 'included';
    const isBlockchainField = aspectName.includes('token') || 
                              aspectName.includes('blockchain') || 
                              aspectName.includes('contract address') || 
                              aspectName.includes('creator') ||
                              aspectName.includes('nft') ||
                              aspectName.includes('crypto');
    return isRequired && !isBrand && !isModelOrType && !isItemsIncluded && !isBlockchainField;
  });
  
  // Find "Items Included" aspect specifically (can be required or optional)
  const ebayItemsIncludedAspect = ebayCategoryAspects.find(aspect => {
    const aspectName = (aspect.localizedAspectName || aspect.aspectName || aspect.name || '').toLowerCase();
    return aspectName.includes('items included') || 
           aspectName.includes('what\'s included') || 
           aspectName === 'items included' ||
           aspectName === 'included';
  });
  
  // Check if Items Included is required
  const isItemsIncludedRequired = ebayItemsIncludedAspect?.aspectConstraint?.aspectMode === 'REQUIRED';

  // For General form, also check if category is selected (fallback if aspects not available)
  const generalHasCategory = generalForm.category && generalForm.category.trim() !== '';
  const shouldShowGeneralSize = generalHasCategory && (hasSizeAspect || generalForm.categoryId);

  // For eBay form, require both category and size aspect
  const ebayHasCategory = ebayForm.categoryId && ebayForm.categoryId !== '0' && ebayForm.categoryId !== 0;
  const shouldShowEbaySize = ebayHasCategory && hasEbaySizeAspect;

  const ebayBrands = ebayBrandAspect?.aspectValues?.map(val => val.localizedValue) || [];
  
  // Extract type values for eBay - handle different possible structures
  let ebayTypeValues = [];
  if (ebayTypeAspect) {
    // Check multiple possible structures for aspect values
    const aspectValues = ebayTypeAspect.aspectValues || 
                        ebayTypeAspect.values || 
                        ebayTypeAspect.value || 
                        [];
    
    if (Array.isArray(aspectValues)) {
      ebayTypeValues = aspectValues.map(val => {
        // Handle different possible structures
        if (typeof val === 'string') {
          return val;
        }
        return val?.localizedValue || val?.value || val?.localizedLabel || val?.label || val;
      }).filter(Boolean).filter(val => val && typeof val === 'string' && val.trim().length > 0);
    } else if (aspectValues) {
      // Single value case
      const singleVal = aspectValues.localizedValue || aspectValues.value || aspectValues.localizedLabel || aspectValues.label || aspectValues;
      if (singleVal && typeof singleVal === 'string' && singleVal.trim().length > 0) {
        ebayTypeValues = [singleVal];
      }
    }
  }
  
  // Extract type values for general form - handle different possible structures
  let typeValues = [];
  if (typeAspect?.aspectValues) {
    typeValues = typeAspect.aspectValues.map(val => {
      // Handle different possible structures
      return val.localizedValue || val.value || val;
    }).filter(Boolean);
  }
  
  // Determine if we should show/require Type field for eBay
  // Show if: category is selected AND (ebayTypeAspect exists OR aspects are still loading)
  const shouldShowEbayType = ebayForm.categoryId && ebayForm.categoryId !== '0' && ebayForm.categoryId !== 0;
  const shouldRequireEbayType = shouldShowEbayType && (isEbayTypeRequired || ebayTypeAspect);

  const addCustomBrand = (brandName) => {
    const trimmed = brandName.trim();
    if (!trimmed) return;
    
    // Check if brand already exists (case-insensitive)
    const exists = [...POPULAR_BRANDS, ...customBrands].some(
      b => b.toLowerCase() === trimmed.toLowerCase()
    );
    
    if (exists) {
      toast({
        title: "Brand already exists",
        description: `"${trimmed}" is already in your brand list.`,
      });
      return;
    }
    
    const updated = [...customBrands, trimmed];
    setCustomBrands(updated);
    localStorage.setItem('customBrands', JSON.stringify(updated));
    
    toast({
      title: "Custom brand added",
      description: `"${trimmed}" has been added to your brand list.`,
    });
    
    return trimmed;
  };

  const handleSaveShippingDefaults = () => {
    const defaults = {
      handlingTime: ebayForm.handlingTime,
      shippingCost: ebayForm.shippingCost,
      shippingService: ebayForm.shippingService,
      shipFromCountry: ebayForm.shipFromCountry,
      acceptReturns: ebayForm.acceptReturns,
      returnWithin: ebayForm.returnWithin,
      returnShippingPayer: ebayForm.returnShippingPayer,
      returnRefundMethod: ebayForm.returnRefundMethod,
      shippingCostType: ebayForm.shippingCostType,
      shippingMethod: ebayForm.shippingMethod,
    };
    saveEbayDefaults(defaults);
  };
  
  const getColorHex = (colorValue) => {
    if (!colorValue) return null;
    if (colorValue.startsWith("#")) return colorValue;
    const color = COMMON_COLORS.find(c => c.name.toLowerCase() === colorValue.toLowerCase());
    return color ? color.hex : null;
  };
  
  const getColorName = (colorValue) => {
    if (!colorValue) return "Select color";
    if (colorValue.startsWith("#")) {
      const color = COMMON_COLORS.find(c => c.hex.toLowerCase() === colorValue.toLowerCase());
      return color ? color.name : colorValue;
    }
    return colorValue;
  };
  
  const handleColorSelect = (colorName, colorHex) => {
    if (editingColorField) {
      const valueToStore = colorName.startsWith("#") ? colorName : colorName;
      if (editingColorField === "ebay.color") {
        handleMarketplaceChange("ebay", "color", valueToStore);
      } else {
        handleGeneralChange(editingColorField, valueToStore);
      }
      setEditingColorField(null);
      setColorPickerOpen(false);
    }
  };

  // Condition mapping functions
  const mapGeneralConditionToEbay = (generalCondition) => {
    const conditionMap = {
      "New With Tags/Box": "New",
      "New Without Tags/Box": "Open Box",
      "Pre - Owned - Good": "Used",
      "Poor (Major flaws)": "Used",
      // These don't map - user must choose manually on eBay
      "New With Imperfections": null,
      "Pre - Owned - Excellent": null,
      "Pre - Owned - Fair": null,
    };
    return conditionMap[generalCondition] || null;
  };

  const handleEbayItemSelect = (inventoryData) => {
    setTemplateForms((prev) => {
      const updated = { ...prev };
      const general = { ...prev.general };
      
      // Populate general form with eBay item data
      if (inventoryData.item_name) general.title = inventoryData.item_name;
      if (inventoryData.image_url) {
        // Add image as photo
        const photo = {
          id: `ebay-${Date.now()}`,
          preview: inventoryData.image_url,
          fileName: "eBay item image",
          fromInventory: true,
        };
        general.photos = [photo, ...(general.photos || [])];
      }
      if (inventoryData.category) general.category = inventoryData.category;
      if (inventoryData.purchase_price) general.cost = String(inventoryData.purchase_price);
      if (inventoryData.notes) {
        general.description = inventoryData.notes;
      }
      
      updated.general = general;
      return updated;
    });
    setEbaySearchDialogOpen(false);
  };
  
  const openColorPicker = (field) => {
    setEditingColorField(field);
    setColorPickerOpen(true);
  };
  
  const handleGeneralChange = (field, value) => {
    setTemplateForms((prev) => {
      const general = { ...prev.general, [field]: value };
      const next = { ...prev, general };

      // Always sync to all marketplace forms (removed inheritGeneral checks)
      // eBay sync
      next.ebay = { ...next.ebay };
      if (field === "title") next.ebay.title = value;
      if (field === "description") next.ebay.description = value;
      if (field === "photos") next.ebay.photos = value;
      if (field === "price") next.ebay.buyItNowPrice = value;
      if (field === "zip") next.ebay.shippingLocation = value;
      if (field === "category") {
        next.ebay.categoryName = value;
        // Also sync the category path for breadcrumb navigation
        setSelectedCategoryPath([...generalCategoryPath]);
      }
      if (field === "categoryId") {
        next.ebay.categoryId = value;
      }
      if (field === "brand") {
        next.ebay.ebayBrand = value;
        next.ebay.brand = value;
      }
      if (field === "sku") {
        next.ebay.sku = value;
      }
      if (field === "condition") {
        const mappedCondition = mapGeneralConditionToEbay(value);
        if (mappedCondition) {
          next.ebay.condition = mappedCondition;
        }
      }

      // Etsy sync
      next.etsy = { ...next.etsy };
      if (field === "title") next.etsy.title = value;
      if (field === "description") next.etsy.description = value;
      if (field === "photos") next.etsy.photos = value;
      if (field === "tags") next.etsy.tags = value;
      if (field === "sku") next.etsy.sku = value;

      // Mercari sync
      next.mercari = { ...next.mercari };
      if (field === "title") next.mercari.title = value;
      if (field === "description") next.mercari.description = value;
      if (field === "photos") next.mercari.photos = value;
      if (field === "price") {
        next.mercari.shippingPrice = Number(value) >= 100 ? "Free" : "Buyer pays";
      }

      // Facebook sync
      next.facebook = { ...next.facebook };
      if (field === "title") next.facebook.title = value;
      if (field === "description") next.facebook.description = value;
      if (field === "photos") next.facebook.photos = value;
      if (field === "zip") {
        next.facebook.meetUpLocation = value ? `Meet near ${value}` : "";
      }
      if (field === "price") {
        next.facebook.shippingPrice = Number(value) >= 75 ? "Free shipping" : "";
      }

      return next;
    });
  };
  
  const handleMarketplaceChange = (marketplace, field, value) => {
    setTemplateForms((prev) => ({
      ...prev,
      [marketplace]: {
        ...prev[marketplace],
        [field]: value,
      },
    }));
  };
  
  const handleToggleInherit = (marketplace, checked) => {
    setTemplateForms((prev) => {
      const updated = {
        ...prev[marketplace],
        inheritGeneral: checked,
      };

      if (checked) {
        // Copy photos and title from general when inheriting
        updated.photos = prev.general.photos || [];
        updated.title = prev.general.title || "";
        updated.description = prev.general.description || "";
        
        if (marketplace === "ebay") {
          updated.buyItNowPrice = prev.general.price;
          updated.shippingLocation = prev.general.zip;
        }
        if (marketplace === "etsy") {
          updated.tags = prev.general.tags;
        }
        if (marketplace === "mercari") {
          updated.shippingPrice = prev.general.price
            ? Number(prev.general.price) >= 100
              ? "Free"
              : "Buyer pays"
            : "";
        }
        if (marketplace === "facebook") {
          updated.meetUpLocation = prev.general.zip ? `Meet near ${prev.general.zip}` : "";
        }
      }

      return {
        ...prev,
        [marketplace]: updated,
      };
    });
  };
  
  // Template storage keys - use item-specific keys when editing an item, global templates for new items
  const getStorageKey = (templateKey, itemId = null) => {
    if (itemId) {
      return `crosslist-item-${itemId}-${templateKey}`;
    }
    return `crosslist-template-${templateKey}`;
  };

  const saveTemplateToStorage = (templateKey, data, itemId = null) => {
    if (typeof window === 'undefined') return;
    try {
      const key = getStorageKey(templateKey, itemId);
      if (key) {
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (error) {
      console.error(`Error saving ${templateKey} template:`, error);
    }
  };

  const loadTemplateFromStorage = (templateKey, itemId = null) => {
    if (typeof window === 'undefined') return null;
    try {
      const key = getStorageKey(templateKey, itemId);
      if (!key) return null;
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      console.error(`Error loading ${templateKey} template:`, error);
      return null;
    }
  };

  const copyGeneralFieldsToMarketplace = (generalData, marketplaceKey) => {
    const copied = {};
    
    // Copy ALL common fields that all marketplaces can use (even if empty to ensure sync)
    copied.title = generalData.title || "";
    copied.description = generalData.description || "";
    copied.quantity = generalData.quantity || "1";
    copied.photos = generalData.photos || [];
    copied.sku = generalData.sku || "";
    copied.category = generalData.category || "";
    copied.size = generalData.size || "";
    copied.color = generalData.color1 || "";
    copied.brand = generalData.brand || "";
    
    // Handle condition mapping for eBay
    if (marketplaceKey === 'ebay') {
      const mappedCondition = mapGeneralConditionToEbay(generalData.condition || "");
      if (mappedCondition) {
        copied.condition = mappedCondition;
      }
      copied.ebayBrand = generalData.brand || "";
    } else {
      copied.condition = generalData.condition || "";
    }
    
    // Marketplace-specific field mappings
    if (marketplaceKey === 'ebay') {
      copied.buyItNowPrice = generalData.price || "";
      copied.shippingLocation = generalData.zip || "";
      copied.categoryId = generalData.categoryId || "";
      copied.categoryName = generalData.category || "";
      // Sync zip code to eBay shipping location
      if (generalData.zip) {
        copied.shippingLocation = generalData.zip;
      }
    } else if (marketplaceKey === 'etsy') {
      copied.tags = generalData.tags || "";
    } else if (marketplaceKey === 'mercari') {
      copied.shippingPrice = generalData.price
        ? (Number(generalData.price) >= 100 ? "Free" : "Buyer pays")
        : "";
    } else if (marketplaceKey === 'facebook') {
      copied.meetUpLocation = generalData.zip ? `Meet near ${generalData.zip}` : "";
      copied.shippingPrice = generalData.price
        ? (Number(generalData.price) >= 75 ? "Free shipping" : "")
        : "";
    }
    
    return copied;
  };

  const handleReconnect = (templateKey) => {
    if (templateKey === 'ebay') {
      // Initiate eBay OAuth flow
      window.location.href = '/api/ebay/auth';
    } else if (templateKey === 'facebook') {
      // Initiate Facebook OAuth flow
      window.location.href = '/auth/facebook/auth';
    } else {
      const label = TEMPLATE_DISPLAY_NAMES[templateKey] || "Marketplace";
      toast({
        title: `${label} reconnected`,
        description: "We'll refresh the integration and pull the latest account settings.",
      });
    }
  };
  
  const handleDisconnectEbay = () => {
    localStorage.removeItem('ebay_user_token');
    setEbayToken(null);
    toast({
      title: "eBay account disconnected",
      description: "Your eBay account has been disconnected.",
    });
  };
  
  const handleConnectEbay = async () => {
    // Save current theme to sessionStorage before OAuth redirect
    const currentTheme = localStorage.getItem('theme') || 'default-light';
    sessionStorage.setItem('preserved_theme', currentTheme);
    
    // Save current form state before redirecting to OAuth
    const stateToSave = {
      templateForms,
      currentEditingItemId,
      activeForm,
      selectedCategoryPath,
      generalCategoryPath,
      itemIds: itemIds.join(','), // Save as comma-separated string
      autoSelect,
    };
    
    // Save to sessionStorage (cleared when tab closes)
    sessionStorage.setItem('ebay_oauth_state', JSON.stringify(stateToSave));
    
    // First check OAuth configuration
    try {
      const debugResponse = await fetch('/api/ebay/auth?debug=true');
      const debugInfo = await debugResponse.json();
      
      console.log('eBay OAuth Configuration:', debugInfo);
      
      // Proceed with OAuth flow
      window.location.href = '/api/ebay/auth';
    } catch (error) {
      console.error('Error checking eBay OAuth config:', error);
      toast({
        title: "Configuration Error",
        description: "Unable to connect to eBay. Please check the console for details.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnectFacebook = () => {
    localStorage.removeItem('facebook_access_token');
    setFacebookToken(null);
    setFacebookPages([]);
    setFacebookSelectedPage(null);
    toast({
      title: "Facebook account disconnected",
      description: "Your Facebook account has been disconnected.",
    });
  };
  
  const handleConnectFacebook = () => {
    // Save current theme to sessionStorage before OAuth redirect
    const currentTheme = localStorage.getItem('theme') || 'default-light';
    sessionStorage.setItem('preserved_theme', currentTheme);
    
    // Save current form state before redirecting to OAuth
    const stateToSave = {
      templateForms,
      currentEditingItemId,
      activeForm,
      selectedCategoryPath,
      generalCategoryPath,
      itemIds: itemIds.join(','), // Save as comma-separated string
      autoSelect,
    };
    
    // Save to sessionStorage (cleared when tab closes)
    sessionStorage.setItem('facebook_oauth_state', JSON.stringify(stateToSave));
    
    // Initiate Facebook OAuth flow
    window.location.href = '/auth/facebook/auth';
  };

  const handleTemplateSave = async (templateKey) => {
    const label = TEMPLATE_DISPLAY_NAMES[templateKey] || "Template";
    const itemId = currentEditingItemId; // Use current item ID if editing an existing item
    
    if (templateKey === 'general') {
      // Save general form (per-item if editing, or as template for new items)
      saveTemplateToStorage('general', generalForm, itemId);
      
      // Always copy general fields to all marketplace forms (auto-sync)
      const updatedForms = { ...templateForms };
      
      // Update eBay form (always sync)
      const ebayUpdates = copyGeneralFieldsToMarketplace(generalForm, 'ebay');
      updatedForms.ebay = { ...updatedForms.ebay, ...ebayUpdates };
      // Also sync the category path state for eBay
      if (generalCategoryPath.length > 0) {
        setSelectedCategoryPath(generalCategoryPath);
      }
      saveTemplateToStorage('ebay', updatedForms.ebay, itemId);
      
      // Update Etsy form (always sync)
      const etsyUpdates = copyGeneralFieldsToMarketplace(generalForm, 'etsy');
      updatedForms.etsy = { ...updatedForms.etsy, ...etsyUpdates };
      saveTemplateToStorage('etsy', updatedForms.etsy, itemId);
      
      // Update Mercari form (always sync)
      const mercariUpdates = copyGeneralFieldsToMarketplace(generalForm, 'mercari');
      updatedForms.mercari = { ...updatedForms.mercari, ...mercariUpdates };
      saveTemplateToStorage('mercari', updatedForms.mercari, itemId);
      
      // Update Facebook form (always sync)
      const facebookUpdates = copyGeneralFieldsToMarketplace(generalForm, 'facebook');
      updatedForms.facebook = { ...updatedForms.facebook, ...facebookUpdates };
      saveTemplateToStorage('facebook', updatedForms.facebook, itemId);
      
      // Update state with copied fields
      setTemplateForms(updatedForms);
      
      // Auto-save to inventory when saving general template
      if (generalForm.title && generalForm.title.trim()) {
        try {
          setIsSaving(true);
          
          // Upload all photos
          const { imageUrl, images } = await uploadAllPhotos(generalForm.photos);

          const customLabels = generalForm.customLabels
            ? generalForm.customLabels.split(',').map(label => label.trim()).filter(Boolean)
            : [];

          const tags = generalForm.tags
            ? generalForm.tags.split(',').map(tag => tag.trim()).filter(Boolean)
            : [];

          const inventoryData = {
            item_name: generalForm.title || "Untitled Item",
            purchase_price: generalForm.cost ? parseFloat(generalForm.cost) : 0,
            listing_price: generalForm.price ? parseFloat(generalForm.price) : 0,
            purchase_date: new Date().toISOString().split('T')[0],
            source: "Crosslist",
            status: "available",
            category: generalForm.category || "",
            quantity: generalForm.quantity ? parseInt(generalForm.quantity, 10) : 1,
            brand: generalForm.brand || "",
            condition: generalForm.condition || "",
            color1: generalForm.color1 || "",
            color2: generalForm.color2 || "",
            color3: generalForm.color3 || "",
            sku: generalForm.sku || "",
            zip_code: generalForm.zip || "",
            size: generalForm.size || "",
            package_details: generalForm.packageDetails || "",
            package_weight: generalForm.packageWeight || "",
            package_length: generalForm.packageLength || "",
            package_width: generalForm.packageWidth || "",
            package_height: generalForm.packageHeight || "",
            custom_labels: generalForm.customLabels || "",
            image_url: imageUrl,
            images: images, // Save all images
            notes: generalForm.description || "",
          };

          let savedItem;
          if (currentEditingItemId) {
            // Update existing inventory item
            savedItem = await base44.entities.InventoryItem.update(currentEditingItemId, inventoryData);
          } else {
            // Create new inventory item
            savedItem = await base44.entities.InventoryItem.create(inventoryData);
          }

          if (savedItem?.id) {
            const allLabels = [...customLabels, ...tags];
            for (const label of allLabels) {
              addTag(savedItem.id, label);
            }
            
            // Update currentEditingItemId so future saves update the same item
            if (!currentEditingItemId) {
              setCurrentEditingItemId(savedItem.id);
            }
          }

          queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });

          toast({
            title: "General template saved",
            description: `Your preferences have been saved, synced to marketplace forms, and the item has been ${currentEditingItemId ? 'updated in' : 'added to'} inventory.`,
            duration: 2000,
          });
        } catch (error) {
          console.error("Error saving item to inventory:", error);
          toast({
            title: "Template saved (inventory save failed)",
            description: "Your preferences have been saved, but there was an error with inventory. You can save it manually later.",
            variant: "destructive",
          });
        } finally {
          setIsSaving(false);
        }
      } else {
        // No title - just show success message
        toast({
          title: "General template saved",
          description: "Your preferences have been saved and automatically synced to all marketplace forms.",
          duration: 2000,
        });
      }
    } else {
      // Save individual marketplace template (per-item if editing, or as template for new items)
      const marketplaceForm = templateForms[templateKey];
      if (marketplaceForm) {
        saveTemplateToStorage(templateKey, marketplaceForm, itemId);
        toast({
          title: `${label} ${itemId ? 'saved' : 'template saved'}`,
          description: itemId 
            ? `Your ${label.toLowerCase()} preferences have been saved for this item.` 
            : "Your preferences will be used the next time you compose a listing.",
        });
      }
    }
  };
  
  const validateEbayForm = () => {
    const errors = [];
    if (!ebayForm.handlingTime) errors.push("Handling Time");
    if (!ebayForm.shippingService) errors.push("Shipping Service");
    if (!ebayForm.shippingCostType) errors.push("Shipping Cost Type");
    if (!ebayForm.shippingMethod) errors.push("Shipping Method");
    if (!ebayForm.pricingFormat) errors.push("Pricing Format");
    if (!ebayForm.duration) errors.push("Duration");
    if (!ebayForm.buyItNowPrice) errors.push("Buy It Now Price");
    if (!ebayForm.color) errors.push("Color");
    
    // Category is validated separately before listing (see finalCategoryId check)
    // Skipping category validation here to avoid false positives with sync issues
    
    // Only require Type if category is selected and ebayTypeAspect exists with values
    if (ebayForm.categoryId && ebayForm.categoryId !== '0' && ebayForm.categoryId !== 0) {
      // Only require if we have the type aspect with values
      if (ebayTypeAspect && ebayTypeValues.length > 0 && !ebayForm.itemType) {
        errors.push(ebayTypeAspect.localizedAspectName || "Model (Type)");
      }
    }
    if (!ebayForm.condition) errors.push("Condition");
    if (!ebayForm.shippingCost) errors.push("Shipping Cost");
    // Only require return fields when Accept Returns is enabled
    if (ebayForm.acceptReturns) {
      if (!ebayForm.returnWithin) errors.push("Return Within");
      if (!ebayForm.returnShippingPayer) errors.push("Return Shipping Payer");
      if (!ebayForm.returnRefundMethod) errors.push("Return Refund Method");
    }
    if (!generalForm.title) errors.push("Title");
    // Check eBay brand, fallback to general brand
    if (!ebayForm.ebayBrand && !generalForm.brand) {
      errors.push("eBay Brand");
    }
    if (!generalForm.quantity) errors.push("Quantity");
    
    // Check required item specifics
    if (isItemsIncludedRequired && !ebayForm.itemsIncluded) {
      errors.push("Items Included");
    }
    // Check other required custom item specifics
    if (ebayRequiredAspects.length > 0) {
      ebayRequiredAspects.forEach(aspect => {
        const aspectName = (aspect.localizedAspectName || aspect.aspectName || aspect.name || '').toLowerCase().replace(/\s+/g, '_');
        if (!ebayForm.customItemSpecifics?.[aspectName]) {
          errors.push(aspect.localizedAspectName || aspect.aspectName || aspect.name);
        }
      });
    }
    
    return errors;
  };
  
  const handleListOnMarketplace = async (marketplace) => {
    if (marketplace === "ebay") {
      const errors = validateEbayForm();
      if (errors.length > 0) {
        toast({
          title: "Missing required fields",
          description: `Please fill in: ${errors.join(", ")}`,
          variant: "destructive",
        });
        return;
      }

      try {
        setIsSaving(true);

        // Upload any photos with blob: URLs to get proper HTTP/HTTPS URLs for eBay
        const sourcePhotos = ebayForm.photos?.length > 0 ? ebayForm.photos : (generalForm.photos || []);
        const photosToUse = [];
        for (const photo of sourcePhotos) {
          if (photo.file && photo.preview && photo.preview.startsWith('blob:')) {
            // Photo needs to be uploaded
            try {
              const uploadPayload = photo.file instanceof File 
                ? photo.file 
                : new File([photo.file], photo.fileName || 'photo.jpg', { type: photo.file.type || 'image/jpeg' });
              
              const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
              photosToUse.push({
                ...photo,
                preview: file_url,
                imageUrl: file_url,
              });
            } catch (uploadError) {
              console.error('Error uploading photo:', uploadError);
              // Skip this photo if upload fails
              continue;
            }
          } else if (photo.preview && (photo.preview.startsWith('http://') || photo.preview.startsWith('https://'))) {
            // Photo already has a valid URL
            photosToUse.push({
              ...photo,
              imageUrl: photo.preview,
            });
          } else if (photo.imageUrl && (photo.imageUrl.startsWith('http://') || photo.imageUrl.startsWith('https://'))) {
            // Photo has imageUrl field with valid URL
            photosToUse.push(photo);
          }
        }

        if (photosToUse.length === 0 && sourcePhotos.length > 0) {
          throw new Error('No valid photo URLs available. Please ensure photos are uploaded or use photos from inventory.');
        }

        // Get category ID from either form
        const finalCategoryId = ebayForm.categoryId || generalForm.categoryId;
        
        // Validate we have a category (check both ID and name as fallback)
        const hasCategorySet = (finalCategoryId && finalCategoryId !== '0' && finalCategoryId !== 0) || 
                              ebayForm.categoryName || 
                              generalForm.category;
        
        if (!hasCategorySet) {
          throw new Error('Please select a category before listing.');
        }
        
        // If we don't have the ID but have the name, that's an issue with sync
        if ((!finalCategoryId || finalCategoryId === '0') && (ebayForm.categoryName || generalForm.category)) {
          throw new Error('Category name is set but ID is missing. Please reselect the category or contact support.');
        }
        
        // Prepare listing data
        const listingData = {
          title: ebayForm.title || generalForm.title,
          description: ebayForm.description || generalForm.description || '',
          categoryId: finalCategoryId,
          price: ebayForm.buyItNowPrice || generalForm.price,
          quantity: parseInt(generalForm.quantity) || 1,
          photos: photosToUse,
          condition: ebayForm.condition || generalForm.condition || 'New',
          brand: ebayForm.ebayBrand || generalForm.brand || '',
          itemType: ebayForm.itemType || '',
          itemTypeAspectName: ebayTypeAspect?.localizedAspectName || ebayTypeAspect?.aspectName || ebayTypeAspect?.name || 'Model',
          packageWeight: generalForm.packageWeight || '',
          postalCode: generalForm.zip || '',
          shippingMethod: ebayForm.shippingMethod,
          shippingCostType: ebayForm.shippingCostType,
          shippingCost: ebayForm.shippingCost,
          shippingService: ebayForm.shippingService,
          handlingTime: ebayForm.handlingTime,
          shipFromCountry: ebayForm.shipFromCountry || 'United States',
          acceptReturns: ebayForm.acceptReturns,
          returnWithin: ebayForm.returnWithin,
          returnShippingPayer: ebayForm.returnShippingPayer,
          returnRefundMethod: ebayForm.returnRefundMethod,
          duration: ebayForm.duration,
          allowBestOffer: ebayForm.allowBestOffer,
          sku: ebayForm.sku || generalForm.sku || '',
          locationDescriptions: ebayForm.locationDescriptions || '',
          shippingLocation: ebayForm.shippingLocation || generalForm.zip || '',
          itemsIncluded: ebayForm.itemsIncluded || '',
          customItemSpecifics: ebayForm.customItemSpecifics || {},
        };

        // Get user token - check if stored or use from request
        let userToken = null;
        if (ebayToken && ebayToken.access_token) {
          // Check if token is expired
          if (ebayToken.expires_at && ebayToken.expires_at > Date.now()) {
            userToken = ebayToken.access_token;
          } else {
            // Token expired - need to refresh or reconnect
            toast({
              title: "eBay token expired",
              description: "Please reconnect your eBay account to continue.",
              variant: "destructive",
            });
            return;
          }
        }
        
        if (!userToken) {
          toast({
            title: "eBay account not connected",
            description: "Please connect your eBay account before listing items.",
            variant: "destructive",
          });
          return;
        }

        // Call eBay listing API
        const response = await fetch('/api/ebay/listing', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation: 'AddFixedPriceItem',
            listingData,
            userToken, // Pass user token
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.Ack === 'Success' || result.Ack === 'Warning') {
          const listingItemId = result.ItemID;
          
          // Store listing ID
          if (listingItemId) {
            setEbayListingId(listingItemId);
            // Store in localStorage associated with current item
            if (currentEditingItemId) {
              localStorage.setItem(`ebay_listing_${currentEditingItemId}`, listingItemId);
            }
          }
          
          // Update inventory item status and save marketplace listing
          if (currentEditingItemId && listingItemId) {
            try {
              // Update inventory item status with listing info
              const updatedItem = await base44.entities.InventoryItem.update(currentEditingItemId, {
                status: 'listed',
                ebay_listing_id: String(listingItemId),
                marketplace_listings: {
                  ebay: {
                    listing_id: String(listingItemId),
                    listed_at: new Date().toISOString(),
                    status: 'active',
                    url: result.ListingURL || `https://www.ebay.com/itm/${listingItemId}`
                  }
                }
              });
              
              // Save marketplace listing record to localStorage
              const listingData = {
                inventory_item_id: currentEditingItemId,
                marketplace: 'ebay',
                marketplace_listing_id: String(listingItemId),
                marketplace_listing_url: result.ListingURL || `https://www.ebay.com/itm/${listingItemId}`,
                status: 'active',
                listed_at: new Date().toISOString(),
                metadata: result,
              };
              
              const listings = JSON.parse(localStorage.getItem('marketplace_listings') || '[]');
              listings.push({
                ...listingData,
                id: `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                created_at: new Date().toISOString(),
              });
              localStorage.setItem('marketplace_listings', JSON.stringify(listings));
              
              // Force immediate refresh of inventory data
              await queryClient.invalidateQueries(['inventoryItems']);
              await queryClient.refetchQueries(['inventoryItems']);
              
            } catch (updateError) {
              console.error('Error updating inventory item:', updateError);
              toast({
                title: "Warning",
                description: "Item listed on eBay but inventory update failed. Please refresh the page.",
                variant: "destructive",
              });
            }
          } else if (!currentEditingItemId) {
            toast({
              title: "Warning", 
              description: "Item listed on eBay but not linked to inventory. Save to General form first.",
              variant: "destructive",
            });
          }

          toast({
            title: "Listing created successfully!",
            description: listingItemId ? `eBay Item ID: ${listingItemId}` : "Your item has been listed on eBay.",
          });
        } else {
          throw new Error(result.Errors?.join(', ') || 'Failed to create listing');
        }

      } catch (error) {
        console.error('Error creating eBay listing:', error);
        toast({
          title: "Failed to create listing",
          description: error.message || "An error occurred while creating the listing. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }

      return;
    }

    if (marketplace === "facebook") {
      // Check if Facebook is connected
      if (!isConnected()) {
        toast({
          title: "Facebook Not Connected",
          description: "Please connect your Facebook account in Settings first.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsSaving(true);

        // Upload any photos with blob: URLs to get proper HTTP/HTTPS URLs for Facebook
        const sourcePhotos = facebookForm.photos?.length > 0 ? facebookForm.photos : (generalForm.photos || []);
        const photosToUse = [];
        for (const photo of sourcePhotos) {
          if (photo.file && photo.preview && photo.preview.startsWith('blob:')) {
            // Photo needs to be uploaded
            try {
              const uploadPayload = photo.file instanceof File 
                ? photo.file 
                : new File([photo.file], photo.fileName || 'photo.jpg', { type: photo.file.type || 'image/jpeg' });
              
              const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
              photosToUse.push(file_url);
            } catch (uploadError) {
              console.error('Error uploading photo:', uploadError);
              // Skip this photo if upload fails
              continue;
            }
          } else if (photo.preview && (photo.preview.startsWith('http://') || photo.preview.startsWith('https://'))) {
            // Photo already has a valid URL
            photosToUse.push(photo.preview);
          } else if (photo.imageUrl && (photo.imageUrl.startsWith('http://') || photo.imageUrl.startsWith('https://'))) {
            // Photo has imageUrl field with valid URL
            photosToUse.push(photo.imageUrl);
          }
        }

        if (photosToUse.length === 0) {
          throw new Error('At least one photo is required for Facebook Marketplace listings.');
        }

        // Get user's Facebook pages
        const pages = await getUserPages();
        if (pages.length === 0) {
          throw new Error('No Facebook Pages found. You must manage at least one Page to create Marketplace listings.');
        }

        // Use selected page or first available page
        const pageId = facebookForm.facebookPageId || facebookSelectedPage?.id || pages[0].id;
        const selectedPage = pages.find(p => p.id === pageId) || pages[0];

        // Prepare Facebook listing data
        const title = facebookForm.title || generalForm.title;
        const description = facebookForm.description || generalForm.description || '';
        const price = facebookForm.price || generalForm.price;

        if (!title || !description || !price) {
          throw new Error('Title, description, and price are required for Facebook Marketplace listings.');
        }

        // Convert price to cents
        const priceInCents = Math.round(parseFloat(price) * 100);

        // Create Facebook Marketplace listing
        const result = await createMarketplaceListing({
          pageId: selectedPage.id,
          title: title,
          description: description,
          price: priceInCents,
          currency: 'USD',
          imageUrls: photosToUse,
        });

        if (result.success) {
          toast({
            title: "Facebook listing created successfully!",
            description: result.message || `Your item has been listed on Facebook Marketplace (${selectedPage.name}).`,
          });

          // Update inventory item status and save marketplace listing
          if (currentEditingItemId && result.id) {
            try {
              // Update inventory item status with listing info
              await base44.entities.InventoryItem.update(currentEditingItemId, {
                status: 'listed',
                facebook_listing_id: String(result.id),
                marketplace_listings: {
                  facebook: {
                    listing_id: String(result.id),
                    listed_at: new Date().toISOString(),
                    status: 'active',
                    url: result.url || ''
                  }
                }
              });
              
              // Save marketplace listing record to localStorage
              const listingData = {
                inventory_item_id: currentEditingItemId,
                marketplace: 'facebook',
                marketplace_listing_id: String(result.id),
                marketplace_listing_url: result.url || '',
                status: 'active',
                listed_at: new Date().toISOString(),
                metadata: result,
              };
              
              const listings = JSON.parse(localStorage.getItem('marketplace_listings') || '[]');
              listings.push({
                ...listingData,
                id: `listing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                created_at: new Date().toISOString(),
              });
              localStorage.setItem('marketplace_listings', JSON.stringify(listings));
              
              // Force immediate refresh of inventory data
              await queryClient.invalidateQueries(['inventoryItems']);
              await queryClient.refetchQueries(['inventoryItems']);
              
            } catch (updateError) {
              console.error('Error updating inventory item:', updateError);
              toast({
                title: "Warning",
                description: "Item listed on Facebook but inventory update failed. Please refresh the page.",
                variant: "destructive",
              });
            }
          }
        } else {
          throw new Error(result.message || 'Failed to create Facebook listing');
        }
      } catch (error) {
        console.error('Error creating Facebook listing:', error);
        toast({
          title: "Failed to create listing",
          description: error.message || "An error occurred while creating the listing. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }

      return;
    }

    if (marketplace === "mercari") {
      try {
        setIsSaving(true);

        // Check if Mercari is connected via extension
        const mercariConnected = localStorage.getItem('profit_orbit_mercari_connected') === 'true';
        
        if (!mercariConnected) {
          toast({
            title: "Mercari Not Connected",
            description: "Please connect your Mercari account in Settings first.",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }

        // Prepare listing data for extension
        const listingData = {
          title: mercariForm.title || generalForm.title,
          description: mercariForm.description || generalForm.description || '',
          price: mercariForm.price || generalForm.price,
          quantity: mercariForm.quantity || generalForm.quantity || 1,
          mercariCategory: mercariForm.mercariCategory || '', // Mercari-specific category
          mercariCategoryId: mercariForm.mercariCategoryId || '', // Mercari category ID
          condition: mercariForm.condition || generalForm.condition,
          brand: mercariForm.brand || generalForm.brand,
          color: mercariForm.color || generalForm.color,
          size: mercariForm.size || generalForm.size,
          photos: mercariForm.photos?.length > 0 ? mercariForm.photos : generalForm.photos || [],
          shipsFrom: mercariForm.shipsFrom || generalForm.zip || '',
          deliveryMethod: mercariForm.deliveryMethod || 'prepaid',
          shippingPayer: mercariForm.shippingCarrier === "Mercari Prepaid" ? "buyer" : "seller",
        };

        // Send to extension for automation
        // The extension will handle the listing in a background tab
        window.postMessage({
          type: 'CREATE_MERCARI_LISTING',
          listingData: listingData
        }, '*');

        toast({
          title: "Creating Mercari Listing...",
          description: "The extension is creating your listing in the background. This may take a few seconds.",
          duration: 5000,
        });

        // Listen for completion message from extension
        const handleListingComplete = (event) => {
          if (event.data.type === 'MERCARI_LISTING_RESPONSE') {
            window.removeEventListener('message', handleListingComplete);
            
            console.log('Received Mercari listing response:', event.data);
            
            if (event.data.success) {
              toast({
                title: "Listed on Mercari!",
                description: (
                  <div>
                    <p>Your item has been listed successfully.</p>
                    {event.data.listingUrl && (
                      <a 
                        href={event.data.listingUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        View Listing →
                      </a>
                    )}
                  </div>
                ),
              });

              // Update inventory item if we have an ID
              if (currentEditingItemId) {
                base44.entities.InventoryItem.update(currentEditingItemId, {
                  status: 'listed',
                  mercari_listing_id: event.data.listingId || '',
                }).catch(err => console.error('Error updating inventory:', err));
              }
            } else {
              toast({
                title: "Listing Failed",
                description: event.data.error || "Failed to create Mercari listing. Please try manually.",
                variant: "destructive",
              });
            }
            
            setIsSaving(false);
          }
        };
        
        window.addEventListener('message', handleListingComplete);
        
        // Timeout after 60 seconds
        setTimeout(() => {
          window.removeEventListener('message', handleListingComplete);
          if (isSaving) {
            setIsSaving(false);
            toast({
              title: "Listing Timeout",
              description: "The listing process took too long. Please check Mercari manually.",
              variant: "destructive",
            });
          }
        }, 60000);

        // Timeout after 30 seconds
        setTimeout(() => {
          window.removeEventListener('message', handleListingComplete);
          setIsSaving(false);
        }, 30000);

      } catch (error) {
        console.error('Error creating Mercari listing:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to create listing.",
          variant: "destructive",
        });
        setIsSaving(false);
      }

      return;
    }

    // For other marketplaces, show coming soon
    toast({
      title: `List on ${TEMPLATE_DISPLAY_NAMES[marketplace] || marketplace}`,
      description: "Listing functionality coming soon!",
    });
  };

  const handleCrosslist = async (marketplaces) => {
    // List on multiple marketplaces
    const marketplacesToUse = marketplaces || ["ebay", "etsy", "mercari", "facebook"];
    const results = [];
    const errors = [];

    setIsSaving(true);

    try {
      // Validate all required forms first
      if (marketplacesToUse.includes("ebay")) {
        const ebayErrors = validateEbayForm();
        if (ebayErrors.length > 0) {
          toast({
            title: "Missing required fields for eBay",
            description: `Please fill in: ${ebayErrors.join(", ")}`,
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
      }

      // List on each marketplace
      for (const marketplace of marketplacesToUse) {
        try {
          if (marketplace === "ebay") {
            // Upload any photos with blob: URLs to get proper HTTP/HTTPS URLs for eBay
            const photosToUse = [];
            for (const photo of generalForm.photos || []) {
              if (photo.file && photo.preview && photo.preview.startsWith('blob:')) {
                // Photo needs to be uploaded
                try {
                  const uploadPayload = photo.file instanceof File 
                    ? photo.file 
                    : new File([photo.file], photo.fileName || 'photo.jpg', { type: photo.file.type || 'image/jpeg' });
                  
                  const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
                  photosToUse.push({
                    ...photo,
                    preview: file_url,
                    imageUrl: file_url,
                  });
                } catch (uploadError) {
                  console.error('Error uploading photo:', uploadError);
                  // Skip this photo if upload fails
                  continue;
                }
              } else if (photo.preview && (photo.preview.startsWith('http://') || photo.preview.startsWith('https://'))) {
                // Photo already has a valid URL
                photosToUse.push({
                  ...photo,
                  imageUrl: photo.preview,
                });
              } else if (photo.imageUrl && (photo.imageUrl.startsWith('http://') || photo.imageUrl.startsWith('https://'))) {
                // Photo has imageUrl field with valid URL
                photosToUse.push(photo);
              }
            }

            if (photosToUse.length === 0 && (generalForm.photos || []).length > 0) {
              throw new Error('No valid photo URLs available. Please ensure photos are uploaded or use photos from inventory.');
            }

            // Prepare eBay listing data
            const listingData = {
              title: generalForm.title,
              description: generalForm.description || '',
              categoryId: ebayForm.categoryId,
              price: ebayForm.buyItNowPrice || generalForm.price,
              quantity: parseInt(generalForm.quantity) || 1,
              photos: photosToUse,
              condition: generalForm.condition || 'new',
              brand: generalForm.brand || ebayForm.ebayBrand || '',
              itemType: ebayForm.itemType || '',
              shippingMethod: ebayForm.shippingMethod,
              shippingCost: ebayForm.shippingCost,
              shippingService: ebayForm.shippingService,
              handlingTime: ebayForm.handlingTime,
              shipFromCountry: ebayForm.shipFromCountry || 'United States',
              acceptReturns: ebayForm.acceptReturns,
              returnWithin: ebayForm.returnWithin,
              returnShippingPayer: ebayForm.returnShippingPayer,
              returnRefundMethod: ebayForm.returnRefundMethod,
              duration: ebayForm.duration,
              allowBestOffer: ebayForm.allowBestOffer,
              sku: generalForm.sku || '',
            };

            const response = await fetch('/api/ebay/listing', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                operation: 'AddFixedPriceItem',
                listingData,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
              throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.Ack === 'Success' || result.Ack === 'Warning') {
              results.push({ marketplace, itemId: result.ItemID });
            } else {
              throw new Error(result.Errors?.join(', ') || 'Failed to create listing');
            }
          } else if (marketplace === "facebook") {
            // Check if Facebook is connected
            if (!isConnected()) {
              throw new Error('Facebook account not connected. Please connect your Facebook account in Settings first.');
            }

            // Upload any photos with blob: URLs to get proper HTTP/HTTPS URLs for Facebook
            const sourcePhotos = facebookForm.photos?.length > 0 ? facebookForm.photos : (generalForm.photos || []);
            const photosToUse = [];
            for (const photo of sourcePhotos) {
              if (photo.file && photo.preview && photo.preview.startsWith('blob:')) {
                // Photo needs to be uploaded
                try {
                  const uploadPayload = photo.file instanceof File 
                    ? photo.file 
                    : new File([photo.file], photo.fileName || 'photo.jpg', { type: photo.file.type || 'image/jpeg' });
                  
                  const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
                  photosToUse.push(file_url);
                } catch (uploadError) {
                  console.error('Error uploading photo:', uploadError);
                  // Skip this photo if upload fails
                  continue;
                }
              } else if (photo.preview && (photo.preview.startsWith('http://') || photo.preview.startsWith('https://'))) {
                // Photo already has a valid URL
                photosToUse.push(photo.preview);
              } else if (photo.imageUrl && (photo.imageUrl.startsWith('http://') || photo.imageUrl.startsWith('https://'))) {
                // Photo has imageUrl field with valid URL
                photosToUse.push(photo.imageUrl);
              }
            }

            if (photosToUse.length === 0) {
              throw new Error('At least one photo is required for Facebook Marketplace listings.');
            }

            // Get user's Facebook pages
            const pages = await getUserPages();
            if (pages.length === 0) {
              throw new Error('No Facebook Pages found. You must manage at least one Page to create Marketplace listings.');
            }

            // Use selected page or first available page
            const pageId = facebookForm.facebookPageId || facebookSelectedPage?.id || pages[0].id;
            const selectedPage = pages.find(p => p.id === pageId) || pages[0];

            // Prepare Facebook listing data
            const title = facebookForm.title || generalForm.title;
            const description = facebookForm.description || generalForm.description || '';
            const price = facebookForm.price || generalForm.price;

            if (!title || !description || !price) {
              throw new Error('Title, description, and price are required for Facebook Marketplace listings.');
            }

            // Convert price to cents
            const priceInCents = Math.round(parseFloat(price) * 100);

            // Create Facebook Marketplace listing
            const result = await createMarketplaceListing({
              pageId: selectedPage.id,
              title: title,
              description: description,
              price: priceInCents,
              currency: 'USD',
              imageUrls: photosToUse,
            });

            if (result.success) {
              results.push({ 
                marketplace, 
                itemId: result.id,
                listingUrl: `https://www.facebook.com/marketplace/item/${result.id}`,
                pageName: selectedPage.name,
              });
            } else {
              throw new Error(result.message || 'Failed to create Facebook listing');
            }
          } else {
            // For other marketplaces, just mark as coming soon for now
            errors.push({ marketplace, error: 'Not yet implemented' });
          }
        } catch (error) {
          console.error(`Error listing on ${marketplace}:`, error);
          errors.push({ marketplace, error: error.message });
        }
      }

      // Update inventory item status if all listings succeeded
      if (results.length > 0 && currentEditingItemId) {
        try {
          await base44.entities.InventoryItem.update(currentEditingItemId, {
            status: 'listed',
          });
          queryClient.invalidateQueries(['inventoryItems']);
        } catch (updateError) {
          console.error('Error updating inventory item:', updateError);
        }
      }

      if (results.length > 0) {
        toast({
          title: "Crosslisted successfully!",
          description: `Listed on ${results.length} marketplace${results.length === 1 ? '' : 's'}: ${results.map(r => r.marketplace).join(', ')}`,
        });
      }

      if (errors.length > 0) {
        toast({
          title: "Some listings failed",
          description: `Failed to list on: ${errors.map(e => e.marketplace).join(', ')}`,
          variant: "destructive",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  const MAX_PHOTOS = 25;
  const MAX_FILE_SIZE_MB = 15;
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  
  // Generic photo upload handler for any marketplace form
  const handlePhotoUpload = async (event, marketplace = 'general') => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingPhotos(true);

    try {
      const formPhotos = marketplace === 'general' 
        ? generalForm.photos 
        : templateForms[marketplace]?.photos || [];
      const currentPhotoCount = formPhotos?.length || 0;
      const remainingSlots = MAX_PHOTOS - currentPhotoCount;
      
      if (remainingSlots <= 0) {
        toast({
          title: "Photo limit reached",
          description: `Maximum ${MAX_PHOTOS} photos allowed. Please remove some photos first.`,
          variant: "destructive",
        });
        return;
      }

      const filesArray = Array.from(files).slice(0, remainingSlots);
      const processedPhotos = [];
      
      for (const file of filesArray) {
        const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
        
        if (file.size > maxSizeBytes) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds ${MAX_FILE_SIZE_MB}MB limit. Compressing...`,
          });
        }

        let processedFile = file;
        if (file.size > 1024 * 1024) {
          try {
            processedFile = await imageCompression(file, {
              maxSizeMB: MAX_FILE_SIZE_MB,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
            });
          } catch (error) {
            console.error("Error compressing image:", error);
            toast({
              title: "Compression failed",
              description: `Skipping ${file.name}. Please try a different image.`,
              variant: "destructive",
            });
            continue;
          }
        }

        processedPhotos.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          preview: URL.createObjectURL(processedFile),
          fileName: file.name,
          file: processedFile,
          fromInventory: false,
        });
      }

      if (processedPhotos.length === 0) {
        return;
      }

      setTemplateForms((prev) => {
        const updated = { ...prev };
        if (marketplace === 'general') {
          const newGeneralPhotos = [...(prev.general.photos || []), ...processedPhotos];
          updated.general = {
            ...prev.general,
            photos: newGeneralPhotos,
          };
          // Sync photos to all marketplace forms
          updated.ebay = { ...prev.ebay, photos: newGeneralPhotos };
          updated.etsy = { ...prev.etsy, photos: newGeneralPhotos };
          updated.mercari = { ...prev.mercari, photos: newGeneralPhotos };
          updated.facebook = { ...prev.facebook, photos: newGeneralPhotos };
        } else {
          updated[marketplace] = {
            ...prev[marketplace],
            photos: [...(prev[marketplace]?.photos || []), ...processedPhotos],
          };
        }
        return updated;
      });

      if (processedPhotos.length < filesArray.length) {
        toast({
          title: "Some photos skipped",
          description: `${processedPhotos.length} of ${filesArray.length} photos added.`,
        });
      }

      if (remainingSlots - processedPhotos.length <= 0) {
        toast({
          title: "Photo limit reached",
          description: `You've reached the maximum of ${MAX_PHOTOS} photos.`,
        });
      }
    } catch (error) {
      console.error("Error processing photos:", error);
      toast({
        title: "Upload error",
        description: "Failed to process some photos. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhotos(false);
      const refMap = {
        'general': photoInputRef,
        'ebay': ebayPhotoInputRef,
        'etsy': etsyPhotoInputRef,
        'mercari': mercariPhotoInputRef,
        'facebook': facebookPhotoInputRef,
      };
      const ref = refMap[marketplace];
      if (ref?.current) {
        ref.current.value = "";
      }
    }
  };
  
  // Generic photo remove handler for any marketplace form
  const handlePhotoRemove = (photoId, marketplace = 'general') => {
    setTemplateForms((prev) => {
      const formPhotos = marketplace === 'general' 
        ? prev.general.photos 
        : prev[marketplace]?.photos || [];
      const targetPhoto = formPhotos.find((photo) => photo.id === photoId);
      if (targetPhoto && !targetPhoto.fromInventory && targetPhoto.preview.startsWith("blob:")) {
        URL.revokeObjectURL(targetPhoto.preview);
      }
      
      const updated = { ...prev };
      if (marketplace === 'general') {
        const newGeneralPhotos = prev.general.photos.filter((photo) => photo.id !== photoId);
        updated.general = {
          ...prev.general,
          photos: newGeneralPhotos,
        };
        // Sync photos to all marketplace forms
        updated.ebay = { ...prev.ebay, photos: newGeneralPhotos };
        updated.etsy = { ...prev.etsy, photos: newGeneralPhotos };
        updated.mercari = { ...prev.mercari, photos: newGeneralPhotos };
        updated.facebook = { ...prev.facebook, photos: newGeneralPhotos };
      } else {
        updated[marketplace] = {
          ...prev[marketplace],
          photos: (prev[marketplace]?.photos || []).filter((photo) => photo.id !== photoId),
        };
      }
      return updated;
    });
  };

  // Generic delete all photos handler for any marketplace form
  const handleDeleteAllPhotos = (marketplace = 'general') => {
    setTemplateForms((prev) => {
      const formPhotos = marketplace === 'general' 
        ? prev.general.photos 
        : prev[marketplace]?.photos || [];
      // Revoke blob URLs for all non-inventory photos
      formPhotos.forEach((photo) => {
        if (!photo.fromInventory && photo.preview.startsWith("blob:")) {
          URL.revokeObjectURL(photo.preview);
        }
      });
      
      const updated = { ...prev };
      if (marketplace === 'general') {
        updated.general = {
          ...prev.general,
          photos: [],
        };
        // Sync empty photos to all marketplace forms
        updated.ebay = { ...prev.ebay, photos: [] };
        updated.etsy = { ...prev.etsy, photos: [] };
        updated.mercari = { ...prev.mercari, photos: [] };
        updated.facebook = { ...prev.facebook, photos: [] };
      } else {
        updated[marketplace] = {
          ...prev[marketplace],
          photos: [],
        };
      }
      return updated;
    });
  };

  const handleSaveEditedImage = async (editedFile) => {
    if (!imageToEdit.photoId || !imageToEdit.marketplace) return;

    try {
      // Create a new preview URL for the edited image
      const newPreview = URL.createObjectURL(editedFile);
      
      // Update the photo in the correct form
      setTemplateForms((prev) => {
        const updated = { ...prev };
        const formPhotos = imageToEdit.marketplace === 'general' 
          ? updated.general.photos 
          : updated[imageToEdit.marketplace]?.photos || [];
        
        const updatedPhotos = formPhotos.map((photo, idx) => {
          if (photo.id === imageToEdit.photoId) {
            return {
              ...photo,
              file: editedFile,
              preview: newPreview,
            };
          }
          return photo;
        });

        if (imageToEdit.marketplace === 'general') {
          updated.general = {
            ...updated.general,
            photos: updatedPhotos,
          };
          // Sync edited photos to all marketplace forms
          updated.ebay = { ...updated.ebay, photos: updatedPhotos };
          updated.etsy = { ...updated.etsy, photos: updatedPhotos };
          updated.mercari = { ...updated.mercari, photos: updatedPhotos };
          updated.facebook = { ...updated.facebook, photos: updatedPhotos };
        } else {
          updated[imageToEdit.marketplace] = {
            ...updated[imageToEdit.marketplace],
            photos: updatedPhotos,
          };
        }

        return updated;
      });

      toast({
        title: "Image Updated",
        description: "The photo has been successfully updated.",
      });
      setEditorOpen(false);
      setImageToEdit({ url: null, photoId: null, marketplace: null, index: null });
    } catch (error) {
      console.error("Error updating image:", error);
      toast({
        title: "Error Updating Image",
        description: "Failed to update the image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleApplyFiltersToAll = async (processedImages, settings) => {
    if (!imageToEdit.marketplace) return;

    try {
      // Update all photos in the current marketplace form with the processed images
      setTemplateForms((prev) => {
        const updated = { ...prev };
        const formPhotos = imageToEdit.marketplace === 'general' 
          ? updated.general.photos 
          : updated[imageToEdit.marketplace]?.photos || [];
        
        // Update each photo with the processed version
        const updatedPhotos = formPhotos.map((photo, idx) => {
          const processedImage = processedImages[idx];
          if (processedImage?.file) {
            return {
              ...photo,
              file: processedImage.file,
              preview: URL.createObjectURL(processedImage.file),
            };
          }
          return photo;
        });

        if (imageToEdit.marketplace === 'general') {
          updated.general = {
            ...updated.general,
            photos: updatedPhotos,
          };
          // Sync filter-applied photos to all marketplace forms
          updated.ebay = { ...updated.ebay, photos: updatedPhotos };
          updated.etsy = { ...updated.etsy, photos: updatedPhotos };
          updated.mercari = { ...updated.mercari, photos: updatedPhotos };
          updated.facebook = { ...updated.facebook, photos: updatedPhotos };
        } else {
          updated[imageToEdit.marketplace] = {
            ...updated[imageToEdit.marketplace],
            photos: updatedPhotos,
          };
        }

        return updated;
      });

      toast({
        title: "Filters Applied to All",
        description: `Successfully applied edits to all ${processedImages.length} images.`,
      });
    } catch (error) {
      console.error("Error applying filters to all:", error);
      toast({
        title: "Error Applying Filters",
        description: "Failed to apply filters to all images. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePhotoReorder = (dragIndex, dropIndex, marketplace = 'general') => {
    setTemplateForms((prev) => {
      const photos = marketplace === 'general'
        ? [...prev.general.photos]
        : [...(prev[marketplace]?.photos || [])];
      const [draggedPhoto] = photos.splice(dragIndex, 1);
      photos.splice(dropIndex, 0, draggedPhoto);
      
      if (marketplace === 'general') {
        return {
          ...prev,
          general: {
            ...prev.general,
            photos,
          },
          // Sync reordered photos to all marketplace forms
          ebay: { ...prev.ebay, photos },
          etsy: { ...prev.etsy, photos },
          mercari: { ...prev.mercari, photos },
          facebook: { ...prev.facebook, photos },
        };
      } else {
        return {
          ...prev,
          [marketplace]: {
            ...prev[marketplace],
            photos,
          },
        };
      }
    });
  };
  
  // Helper function to upload all photos and return images array
  const uploadAllPhotos = async (photos) => {
    if (!photos || photos.length === 0) return { imageUrl: "", images: [] };

    const uploadedImageUrls = [];
    let mainImageUrl = "";

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      let imageUrl = "";

      if (photo.file) {
        const uploadPayload = photo.file instanceof File 
          ? photo.file 
          : new File([photo.file], photo.fileName || `photo_${i}.jpg`, { type: photo.file.type || 'image/jpeg' });
        
        const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadPayload });
        imageUrl = file_url;
      } else if (photo.preview && !photo.preview.startsWith('blob:')) {
        imageUrl = photo.preview;
      } else if (photo.imageUrl) {
        imageUrl = photo.imageUrl;
      } else if (photo.url) {
        imageUrl = photo.url;
      }

      if (imageUrl) {
        if (i === 0) {
          mainImageUrl = imageUrl; // First photo is main
        }
        uploadedImageUrls.push(imageUrl); // Just push the URL string
      }
    }

    return { imageUrl: mainImageUrl, images: uploadedImageUrls };
  };

  const handleSaveToInventory = async () => {
    setIsSaving(true);
    try {
      // Upload all photos
      const { imageUrl, images } = await uploadAllPhotos(generalForm.photos);

      const customLabels = generalForm.customLabels
        ? generalForm.customLabels.split(',').map(label => label.trim()).filter(Boolean)
        : [];

      const tags = generalForm.tags
        ? generalForm.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        : [];

      const inventoryData = {
        item_name: generalForm.title || "Untitled Item",
        purchase_price: generalForm.cost ? parseFloat(generalForm.cost) : 0,
        listing_price: generalForm.price ? parseFloat(generalForm.price) : 0,
        purchase_date: new Date().toISOString().split('T')[0],
        source: "Crosslist",
        status: "available",
        category: generalForm.category || "",
        quantity: generalForm.quantity ? parseInt(generalForm.quantity, 10) : 1,
        brand: generalForm.brand || "",
        condition: generalForm.condition || "",
        color1: generalForm.color1 || "",
        color2: generalForm.color2 || "",
        color3: generalForm.color3 || "",
        sku: generalForm.sku || "",
        zip_code: generalForm.zip || "",
        size: generalForm.size || "",
        package_details: generalForm.packageDetails || "",
        package_weight: generalForm.packageWeight || "",
        package_length: generalForm.packageLength || "",
        package_width: generalForm.packageWidth || "",
        package_height: generalForm.packageHeight || "",
        custom_labels: generalForm.customLabels || "",
        image_url: imageUrl,
        images: images, // Save all images
        notes: generalForm.description || "",
      };

      let savedItem;
      if (currentEditingItemId) {
        // Update existing item
        savedItem = await base44.entities.InventoryItem.update(currentEditingItemId, inventoryData);
      } else {
        // Create new item
        savedItem = await base44.entities.InventoryItem.create(inventoryData);
      }

      if (savedItem?.id) {
        const allLabels = [...customLabels, ...tags];
        for (const label of allLabels) {
          addTag(savedItem.id, label);
        }
        
        // Update currentEditingItemId for future saves
        if (!currentEditingItemId) {
          setCurrentEditingItemId(savedItem.id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });

      toast({
        title: "Item saved to inventory",
        description: `${generalForm.title || "Item"} has been ${currentEditingItemId ? 'updated in' : 'added to'} your inventory.`,
      });

      navigate(createPageUrl("Crosslist"));
    } catch (error) {
      console.error("Error saving inventory item:", error);
      toast({
        title: "Failed to save item",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <div className="max-w-5xl mx-auto space-y-6 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate(createPageUrl("Crosslist"))}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Crosslist
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {bulkSelectedItems.length > 1 ? "Bulk Crosslist" : "Compose Listing"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {bulkSelectedItems.length > 1
                ? `Editing ${bulkSelectedItems.length} items. Select an item to configure its listing.`
                : "Choose marketplaces and set the base fields. Full per-market fine-tuning can follow."}
            </p>
          </div>
        </div>

        {/* eBay Account Connection Section - At Top (Only show on eBay form) */}
        {activeForm === "ebay" && (
        <div className="rounded-lg border border-muted-foreground/30 bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={EBAY_ICON_URL} alt="eBay" className="w-5 h-5" />
              <Label className="text-base font-semibold">eBay Account</Label>
            </div>
            {ebayToken ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect("ebay")}>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect
                </Button>
                <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={handleDisconnectEbay}>
                  <X className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button variant="default" size="sm" className="gap-2" onClick={handleConnectEbay}>
                <Check className="h-4 w-4" />
                Connect eBay Account
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
            {/* Status */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Status</Label>
              <div className="flex items-center gap-2">
                {ebayToken ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">Connected</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">Not Connected</span>
                  </>
                )}
              </div>
            </div>

            {/* Token Expires */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Token Expires</Label>
              <div className="text-sm">
                {ebayToken?.expires_at ? (
                  <span>{new Date(ebayToken.expires_at).toLocaleDateString()}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>

            {/* eBay Account (Username) */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">eBay Account</Label>
              <div className="text-sm">
                {ebayUsername ? (
                  <span className="font-medium">{ebayUsername}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Facebook Account Connection Section - At Top (Only show on Facebook form) */}
        {activeForm === "facebook" && (
        <div className="rounded-lg border border-muted-foreground/30 bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={FACEBOOK_ICON_URL} alt="Facebook" className="w-5 h-5" />
              <Label className="text-base font-semibold">Facebook Account</Label>
            </div>
            {facebookToken ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect("facebook")}>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect
                </Button>
                <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={handleDisconnectFacebook}>
                  <X className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button variant="default" size="sm" className="gap-2" onClick={handleConnectFacebook}>
                <Check className="h-4 w-4" />
                Connect Facebook Account
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
            {/* Status */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Status</Label>
              <div className="flex items-center gap-2">
                {facebookToken ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">Connected</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">Not Connected</span>
                  </>
                )}
              </div>
            </div>

            {/* Token Expires */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Token Expires</Label>
              <div className="text-sm">
                {facebookToken?.expires_at ? (
                  <span>{new Date(facebookToken.expires_at).toLocaleDateString()}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>

            {/* Facebook Pages */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Available Pages</Label>
              <div className="text-sm">
                {facebookPages.length > 0 ? (
                  <span className="font-medium">{facebookPages.length} page{facebookPages.length !== 1 ? 's' : ''}</span>
                ) : facebookToken ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Show selected page if available */}
          {facebookPages.length > 0 && (
            <div className="pt-2 border-t">
              <Label className="text-xs text-muted-foreground mb-2 block">Selected Page</Label>
              <Select
                value={facebookSelectedPage?.id || ""}
                onValueChange={(value) => {
                  const page = facebookPages.find(p => p.id === value);
                  setFacebookSelectedPage(page);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a page">
                    {facebookSelectedPage?.name || "Select a page"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {facebookPages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Listings will be posted on behalf of this page.
              </p>
            </div>
          )}
        </div>
        )}

        {/* Bulk item selector */}
        {bulkSelectedItems.length > 1 && (
          <div className="space-y-3">
            <Label className="text-xs mb-1.5 block">Select Item to Edit</Label>
            <div className="flex flex-wrap gap-2">
              {bulkSelectedItems.map((item) => {
                const isCurrent = currentEditingItemId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchToItem(item.id)}
                    className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                      isCurrent
                        ? "border-primary bg-primary/10 ring-2 ring-primary"
                        : "border-muted-foreground/40 hover:border-primary/50 bg-muted/30"
                    }`}
                  >
                    <img
                      src={item.image_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"}
                      alt={item.item_name}
                      className="w-16 h-16 rounded-md object-cover"
                    />
                    <span className={`text-xs text-center max-w-[80px] truncate ${
                      isCurrent ? "font-semibold text-primary" : "text-muted-foreground"
                    }`}>
                      {item.item_name}
                    </span>
                    {isCurrent && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {currentEditingItemId && (
              <Alert className="bg-primary/10 border-primary/20">
                <AlertDescription className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-primary">
                    You are currently editing: {bulkSelectedItems.find(item => item.id === currentEditingItemId)?.item_name || "Unknown Item"}
                  </span>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Form selector */}
        <div>
          <Label className="text-xs mb-1.5 block">Select Form</Label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveForm("general")}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-sm transition
                ${activeForm === "general"
                  ? "bg-foreground text-background dark:bg-foreground dark:text-background"
                  : "bg-muted/70 hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted/60 text-foreground"
                }`}
            >
              General
            </button>
            {MARKETPLACES.map((m) => {
              const active = activeForm === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveForm(m.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-sm transition
                    ${active
                      ? "bg-foreground text-background dark:bg-foreground dark:text-background"
                      : "bg-muted/70 hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted/60 text-foreground"
                    }`}
                >
                  {renderMarketplaceIcon(m)}
                  {m.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Select a form to configure. General form data syncs to all marketplace-specific forms.
          </p>
        </div>

        {/* Form Content */}
        <div className="mt-6 space-y-6">
          {/* General Form */}
          {activeForm === "general" && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item Photos</Label>
                  {generalForm.photos && generalForm.photos.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDeleteAllPhotos}
                      className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Delete All
                    </Button>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                  {/* Main Photo - spans 2 columns and 2 rows */}
                  {generalForm.photos.length > 0 && (
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", "0");
                        e.currentTarget.classList.add("opacity-50");
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.classList.remove("opacity-50");
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                        const dropIndex = 0;
                        if (dragIndex !== dropIndex) {
                          handlePhotoReorder(dragIndex, dropIndex);
                        }
                        e.currentTarget.classList.remove("opacity-50");
                      }}
                      className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-lg border-2 border-primary bg-muted cursor-move"
                    >
                      <img src={generalForm.photos[0].preview} alt={generalForm.photos[0].fileName || "Main photo"} className="h-full w-full object-cover" />
                      <div className="absolute top-1 left-1 inline-flex items-center justify-center rounded px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold uppercase">
                        Main
                      </div>
                      <div className="absolute top-1 right-1 flex gap-1 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageToEdit({ 
                              url: generalForm.photos[0].preview, 
                              photoId: generalForm.photos[0].id, 
                              marketplace: 'general',
                              index: 0
                            });
                            setEditorOpen(true);
                          }}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/80 text-white hover:bg-blue-700/90"
                          title="Edit photo"
                        >
                          <ImageIcon className="h-3 w-3" />
                          <span className="sr-only">Edit photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(generalForm.photos[0].id);
                          }}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Other Photos */}
                  {generalForm.photos.slice(1).map((photo, index) => (
                    <div
                      key={photo.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(index + 1));
                        e.currentTarget.classList.add("opacity-50");
                      }}
                      onDragEnd={(e) => {
                        e.currentTarget.classList.remove("opacity-50");
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                        const dropIndex = index + 1;
                        if (dragIndex !== dropIndex) {
                          handlePhotoReorder(dragIndex, dropIndex);
                        }
                        e.currentTarget.classList.remove("opacity-50");
                      }}
                      className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted cursor-move hover:border-muted-foreground/60 transition"
                    >
                      <img src={photo.preview} alt={photo.fileName || "Listing photo"} className="h-full w-full object-cover" />
                      <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
                        <GripVertical className="h-4 w-4 md:h-6 md:w-6 text-white" />
                      </div>
                      <div className="absolute top-1 right-1 flex gap-1 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageToEdit({ 
                              url: photo.preview, 
                              photoId: photo.id, 
                              marketplace: 'general',
                              index: index + 1
                            });
                            setEditorOpen(true);
                          }}
                          className="inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-blue-600/80 text-white hover:bg-blue-700/90"
                          title="Edit photo"
                        >
                          <ImageIcon className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          <span className="sr-only">Edit photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(photo.id);
                          }}
                          className="inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Add Photo Button - same size as photo tiles */}
                  {(generalForm.photos?.length || 0) < MAX_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploadingPhotos}
                      className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                    >
                      <ImagePlus className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                      <span className="mt-1 text-[10px] md:text-xs font-medium text-muted-foreground">Add</span>
                    </button>
                  )}
                  <input
                    ref={photoInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Up to {MAX_PHOTOS} photos, {MAX_FILE_SIZE_MB}MB per photo. {generalForm.photos?.length || 0}/{MAX_PHOTOS} used.
                  {isUploadingPhotos && <span className="ml-2 text-amber-600 dark:text-amber-400">Processing photos...</span>}
                </p>
              </div>

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label htmlFor="general-title" className="text-xs mb-1.5 block">Title</Label>
                  <div className="flex gap-2">
                    <Input
                      id="general-title"
                      name="general-title"
                      placeholder=""
                      value={generalForm.title || ""}
                      onChange={(e) => handleGeneralChange("title", e.target.value)}
                      className="w-full"
                    />
                    {generalForm.title?.trim() && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSoldDialogOpen(true);
                        }}
                        className="whitespace-nowrap"
                      >
                        <BarChart className="w-4 h-4 mr-2" />
                        Search
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="general-price" className="text-xs mb-1.5 block">Listing Price</Label>
                  <Input
                    id="general-price"
                    name="general-price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={generalForm.price || ""}
                    onChange={(e) => handleGeneralChange("price", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Price you'll list this item for</p>
                </div>
                <div>
                  <Label htmlFor="general-cost" className="text-xs mb-1.5 block">Purchase Price</Label>
                  <Input
                    id="general-cost"
                    name="general-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={generalForm.cost || ""}
                    onChange={(e) => handleGeneralChange("cost", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="general-description" className="text-xs">Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDescriptionGeneratorOpen(true)}
                      className="gap-2 h-7 text-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI Generate
                    </Button>
                  </div>
                  <RichTextarea
                    id="general-description"
                    name="general-description"
                    placeholder="Enter a detailed description of your item..."
                    value={generalForm.description || ""}
                    onChange={(e) => handleGeneralChange("description", e.target.value)}
                    className="min-h-[120px]"
                  />
                </div>
                <div>
                  <Label htmlFor="general-brand" className="text-xs mb-1.5 block">Brand</Label>
                  {brandIsCustom ? (
                    <div className="flex gap-2">
                      <Input
                        id="general-brand"
                        name="general-brand"
                        placeholder="Enter brand name and press Enter to save"
                        value={generalForm.brand || ""}
                        onChange={(e) => handleGeneralChange("brand", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && generalForm.brand?.trim()) {
                            e.preventDefault();
                            const savedBrand = addCustomBrand(generalForm.brand);
                            if (savedBrand) {
                              setBrandIsCustom(false);
                            }
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => {
                          if (generalForm.brand?.trim()) {
                            const savedBrand = addCustomBrand(generalForm.brand);
                            if (savedBrand) {
                              setBrandIsCustom(false);
                            }
                          }
                        }}
                        disabled={!generalForm.brand?.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBrandIsCustom(false);
                          handleGeneralChange("brand", "");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Popover open={brandSearchOpen} onOpenChange={setBrandSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={brandSearchOpen}
                          className="w-full justify-between"
                        >
                          {generalForm.brand
                            ? POPULAR_BRANDS.find((brand) => brand === generalForm.brand) || generalForm.brand
                            : "Search brand..."}
                          <ArrowRight className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search brand..." />
                          <CommandList>
                            <CommandEmpty>No brand found.</CommandEmpty>
                            <CommandGroup>
                              {POPULAR_BRANDS.map((brand) => (
                                <CommandItem
                                  key={brand}
                                  value={brand}
                                  onSelect={() => {
                                    handleGeneralChange("brand", brand);
                                    setBrandSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      generalForm.brand === brand ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {brand}
                                </CommandItem>
                              ))}
                              <CommandItem
                                value="custom"
                                onSelect={() => {
                                  setBrandIsCustom(true);
                                  setBrandSearchOpen(false);
                                  handleGeneralChange("brand", "");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    "opacity-0"
                                  )}
                                />
                                Add Custom...
                              </CommandItem>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <div>
                  <Label htmlFor="general-condition" className="text-xs mb-1.5 block">Condition</Label>
                  <Select
                    value={generalForm.condition ? String(generalForm.condition) : undefined}
                    onValueChange={(value) => {
                      handleGeneralChange("condition", value);
                      // Map condition to eBay form
                      const ebayCondition = mapGeneralConditionToEbay(value);
                      if (ebayCondition) {
                        handleMarketplaceChange("ebay", "condition", ebayCondition);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New With Tags/Box">New With Tags/Box</SelectItem>
                      <SelectItem value="New Without Tags/Box">New Without Tags/Box</SelectItem>
                      <SelectItem value="New With Imperfections">New With Imperfections</SelectItem>
                      <SelectItem value="Pre - Owned - Excellent">Pre - Owned - Excellent</SelectItem>
                      <SelectItem value="Pre - Owned - Good">Pre - Owned - Good</SelectItem>
                      <SelectItem value="Pre - Owned - Fair">Pre - Owned - Fair</SelectItem>
                      <SelectItem value="Poor (Major flaws)">Poor (Major flaws)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="general-sku" className="text-xs mb-1.5 block">SKU</Label>
                  <Input
                    id="general-sku"
                    name="general-sku"
                    placeholder=""
                    value={generalForm.sku || ""}
                    onChange={(e) => handleGeneralChange("sku", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Primary Color</Label>
                  <Button
                    type="button"
                    variant={generalForm.color1 ? "default" : "outline"}
                    onClick={() => openColorPicker("color1")}
                    className="w-full justify-start"
                  >
                    {generalForm.color1 ? (
                      <>
                        <div
                          className="w-4 h-4 mr-2 rounded border border-gray-200 dark:border-gray-700 flex-shrink-0"
                          style={{ backgroundColor: getColorHex(generalForm.color1) || "#808080" }}
                        />
                        <span className="flex-1 text-left">{getColorName(generalForm.color1)}</span>
                      </>
                    ) : (
                      <>
                        <Palette className="w-4 h-4 mr-2" />
                        <span>Select color</span>
                      </>
                    )}
                  </Button>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Secondary Color</Label>
                  <Button
                    type="button"
                    variant={generalForm.color2 ? "default" : "outline"}
                    onClick={() => openColorPicker("color2")}
                    className="w-full justify-start"
                  >
                    {generalForm.color2 ? (
                      <>
                        <div
                          className="w-4 h-4 mr-2 rounded border border-gray-200 dark:border-gray-700 flex-shrink-0"
                          style={{ backgroundColor: getColorHex(generalForm.color2) || "#808080" }}
                        />
                        <span className="flex-1 text-left">{getColorName(generalForm.color2)}</span>
                      </>
                    ) : (
                      <>
                        <Palette className="w-4 h-4 mr-2" />
                        <span>Select color</span>
                      </>
                    )}
                  </Button>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Category</Label>
                  
                  {/* Breadcrumb navigation for category path */}
                  {generalCategoryPath.length > 0 && (
                    <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => {
                          setGeneralCategoryPath([]);
                          handleGeneralChange("category", "");
                          handleGeneralChange("categoryId", "");
                        }}
                        className="hover:text-foreground underline"
                      >
                        Home
                      </button>
                      {generalCategoryPath.map((cat, index) => (
                        <React.Fragment key={cat.categoryId}>
                          <span>/</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newPath = generalCategoryPath.slice(0, index + 1);
                              setGeneralCategoryPath(newPath);
                              const lastCat = newPath[newPath.length - 1];
                              const fullPath = newPath.map(c => c.categoryName).join(" > ");
                              handleGeneralChange("category", fullPath);
                              if (lastCat?.categoryId) {
                                handleGeneralChange("categoryId", lastCat.categoryId);
                              }
                            }}
                            className="hover:text-foreground underline"
                          >
                            {cat.categoryName}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                  
                  {isLoadingCategoryTree || isLoadingCategories ? (
                    <div className="flex items-center gap-2 p-3 border rounded-md">
                      <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Loading categories...</span>
                    </div>
                  ) : categoriesError ? (
                    <div className="p-3 border rounded-md border-destructive/50 bg-destructive/10">
                      <p className="text-sm text-destructive">Error loading categories: {categoriesError.message}</p>
                      {categoriesError?.response?.details && (
                        <p className="text-xs text-destructive mt-2">
                          Details: {JSON.stringify(categoriesError.response.details)}
                        </p>
                      )}
                    </div>
                  ) : sortedCategories.length > 0 ? (
                    <Select
                      value={undefined}
                      onValueChange={(value) => {
                        const selectedCategory = sortedCategories.find(
                          cat => cat.category?.categoryId === value
                        );
                        
                        if (selectedCategory) {
                          const category = selectedCategory.category;
                          const newPath = [...generalCategoryPath, {
                            categoryId: category.categoryId,
                            categoryName: category.categoryName,
                          }];
                          
                          // Check if this category has children
                          const hasChildren = selectedCategory.childCategoryTreeNodes && 
                            selectedCategory.childCategoryTreeNodes.length > 0 &&
                            !selectedCategory.leafCategoryTreeNode;
                          
                          if (hasChildren) {
                            // Navigate deeper into the tree
                            setGeneralCategoryPath(newPath);
                          } else {
                            // This is a leaf node - select it
                            const fullPath = newPath.map(c => c.categoryName).join(" > ");
                            const categoryId = category.categoryId;
                            handleGeneralChange("category", fullPath);
                            handleGeneralChange("categoryId", categoryId);
                            setGeneralCategoryPath(newPath);
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={generalCategoryPath.length > 0 ? "Select subcategory" : "Select a category"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {sortedCategories.map((categoryNode) => {
                          const category = categoryNode.category;
                          if (!category || !category.categoryId) return null;
                          
                          const hasChildren = categoryNode.childCategoryTreeNodes && 
                            categoryNode.childCategoryTreeNodes.length > 0 &&
                            !categoryNode.leafCategoryTreeNode;
                          
                          return (
                            <SelectItem key={category.categoryId} value={category.categoryId}>
                              <div className="flex items-center gap-2">
                                <span>{category.categoryName}</span>
                                {hasChildren && (
                                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-3 border rounded-md">
                      <p className="text-sm text-muted-foreground">No subcategories available.</p>
                    </div>
                  )}
                  
                  {generalForm.category && (
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        Selected: {generalForm.category}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleGeneralChange("category", "");
                          handleGeneralChange("categoryId", "");
                          setGeneralCategoryPath([]);
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* US Size - Only show when category is selected and has size aspect */}
                {shouldShowGeneralSize && (
                  <div>
                    <Label className="text-xs mb-1.5 block">US Size</Label>
                    <Input
                      placeholder="e.g. Men's M, 10, XL"
                      value={generalForm.size}
                      onChange={(e) => handleGeneralChange("size", e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Shipping Settings Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Save className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Shipping Settings</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label htmlFor="general-zip" className="text-xs mb-1.5 block">Zip Code</Label>
                  <Input
                    id="general-zip"
                    name="general-zip"
                    placeholder="Enter Zip Code"
                    value={generalForm.zip || ""}
                    onChange={(e) => handleGeneralChange("zip", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={generalForm.quantity}
                    onChange={(e) => handleGeneralChange("quantity", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Tags</Label>
                  <TagInput
                    placeholder="Type keywords and press space or comma to add tags (used for Mercari and Facebook)"
                    value={generalForm.tags}
                    onChange={(value) => handleGeneralChange("tags", value)}
                  />
                </div>
              </div>

              {/* Package Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Package Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-xs mb-1.5 block">
                    Package Details <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant={generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight ? "default" : "outline"}
                    onClick={() => setPackageDetailsDialogOpen(true)}
                    className="w-full justify-start"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    {generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight
                      ? `${generalForm.packageWeight} lbs • ${generalForm.packageLength}" × ${generalForm.packageWidth}" × ${generalForm.packageHeight}"`
                      : "Enter weight & size"}
                  </Button>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Custom Labels</Label>
                  <Input
                    placeholder="Comma-separated labels (e.g. Q4 Liquidation, Holiday Gift). These will appear as tags in inventory."
                    value={generalForm.customLabels}
                    onChange={(e) => handleGeneralChange("customLabels", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Custom labels will be saved as tags in your inventory page
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2" onClick={() => handleTemplateSave("general")}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* eBay Form */}
          {activeForm === "ebay" && (
            <div className="space-y-6">
              {currentEditingItemId && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Item ID:</span>
                  <span className="text-sm text-muted-foreground font-mono">{currentEditingItemId}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">eBay listing specifics</h3>
                  <p className="text-sm text-muted-foreground">
                    Media, title, description, and pricing inherit from your General template.
                  </p>
                </div>
              </div>

              {/* Photos Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item Photos</Label>
                  {(ebayForm.photos?.length > 0) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAllPhotos('ebay')}
                      className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Delete All
                    </Button>
                  )}
                </div>
                  <div className="mt-2 grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                    {/* Main Photo - spans 2 columns and 2 rows */}
                    {ebayForm.photos?.length > 0 && (
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", "0");
                          e.currentTarget.classList.add("opacity-50");
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          const dropIndex = 0;
                          if (dragIndex !== dropIndex) {
                            handlePhotoReorder(dragIndex, dropIndex, 'ebay');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-lg border-2 border-primary bg-muted cursor-move"
                      >
                        <img src={ebayForm.photos[0].preview || ebayForm.photos[0].imageUrl} alt={ebayForm.photos[0].fileName || "Main photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-1 left-1 inline-flex items-center justify-center rounded px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold uppercase">
                          Main
                        </div>
                        <div className="absolute top-1 right-1 flex gap-1 z-10">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImageToEdit({ 
                                url: ebayForm.photos[0].preview || ebayForm.photos[0].imageUrl, 
                                photoId: ebayForm.photos[0].id, 
                                marketplace: 'ebay',
                                index: 0
                              });
                              setEditorOpen(true);
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600/80 text-white hover:bg-blue-700/90"
                            title="Edit photo"
                          >
                            <ImageIcon className="h-3 w-3" />
                            <span className="sr-only">Edit photo</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePhotoRemove(ebayForm.photos[0].id, 'ebay');
                            }}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span className="sr-only">Remove photo</span>
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Other Photos */}
                    {ebayForm.photos?.slice(1).map((photo, index) => (
                      <div
                        key={photo.id || index + 1}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(index + 1));
                          e.currentTarget.classList.add("opacity-50");
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          const dropIndex = index + 1;
                          if (dragIndex !== dropIndex) {
                            handlePhotoReorder(dragIndex, dropIndex, 'ebay');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted cursor-move hover:border-muted-foreground/60 transition"
                      >
                        <img src={photo.preview || photo.imageUrl} alt={photo.fileName || "Listing photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
                          <GripVertical className="h-4 w-4 md:h-6 md:w-6 text-white" />
                        </div>
                      <div className="absolute top-1 right-1 flex gap-1 z-10">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageToEdit({ 
                              url: photo.preview || photo.imageUrl, 
                              photoId: photo.id, 
                              marketplace: 'ebay',
                              index: index + 1
                            });
                            setEditorOpen(true);
                          }}
                          className="inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-blue-600/80 text-white hover:bg-blue-700/90"
                          title="Edit photo"
                        >
                          <ImageIcon className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          <span className="sr-only">Edit photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(photo.id, 'ebay');
                          }}
                          className="inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                      </div>
                    ))}
                    
                    {/* Add Photo Button - same size as photo tiles */}
                    {(ebayForm.photos?.length || 0) < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => ebayPhotoInputRef.current?.click()}
                        disabled={isUploadingPhotos}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                      >
                        <ImagePlus className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                        <span className="mt-1 text-[10px] md:text-xs font-medium text-muted-foreground">Add</span>
                      </button>
                    )}
                    <input
                      ref={ebayPhotoInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'ebay')}
                    />
                  </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Up to {MAX_PHOTOS} photos, {MAX_FILE_SIZE_MB}MB per photo. {ebayForm.photos?.length || 0}/{MAX_PHOTOS} used.
                  {isUploadingPhotos && <span className="ml-2 text-amber-600 dark:text-amber-400">Processing photos...</span>}
                </p>
              </div>

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Title Section */}
                <div>
                  <Label htmlFor="ebay-title" className="text-xs mb-1.5 block">Title</Label>
                  <Input
                    id="ebay-title"
                    name="ebay-title"
                    placeholder="Enter listing title"
                    value={ebayForm.title || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "title", e.target.value)}
                  />
                </div>

                {/* Description Section */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="ebay-description" className="text-xs">Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDescriptionGeneratorOpen(true)}
                      className="gap-2 h-7 text-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI Generate
                    </Button>
                  </div>
                  <RichTextarea
                    id="ebay-description"
                    name="ebay-description"
                    placeholder={generalForm.description ? `Inherited from General` : "Enter eBay-specific description..."}
                    value={ebayForm.description || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "description", e.target.value)}
                    className="min-h-[120px]"
                  />
                  {generalForm.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>

                {/* eBay Brand - use same dropdown as general form */}
                <div className="md:col-span-2">
                  <Label htmlFor="ebay-brand" className="text-xs mb-1.5 block">Brand <span className="text-red-500">*</span></Label>
                  {brandIsCustom ? (
                    <div className="flex gap-2">
                      <Input
                        id="ebay-brand"
                        name="ebay-brand"
                        placeholder="Enter brand name and press Enter to save"
                        value={ebayForm.ebayBrand || ""}
                        onChange={(e) => handleMarketplaceChange("ebay", "ebayBrand", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && ebayForm.ebayBrand?.trim()) {
                            e.preventDefault();
                            const savedBrand = addCustomBrand(ebayForm.ebayBrand);
                            if (savedBrand) {
                              setBrandIsCustom(false);
                            }
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => {
                          if (ebayForm.ebayBrand?.trim()) {
                            const savedBrand = addCustomBrand(ebayForm.ebayBrand);
                            if (savedBrand) {
                              setBrandIsCustom(false);
                            }
                          }
                        }}
                        disabled={!ebayForm.ebayBrand?.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBrandIsCustom(false);
                          handleMarketplaceChange("ebay", "ebayBrand", "");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={ebayForm.ebayBrand || generalForm.brand ? String(ebayForm.ebayBrand || generalForm.brand) : undefined}
                      onValueChange={(value) => {
                        if (value === "custom") {
                          setBrandIsCustom(true);
                          handleMarketplaceChange("ebay", "ebayBrand", "");
                        } else {
                          handleMarketplaceChange("ebay", "ebayBrand", value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={generalForm.brand ? `Inherited: ${generalForm.brand}` : "Select or Custom"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">+ Add Custom Brand</SelectItem>
                        {customBrands.length > 0 && customBrands.map((brand) => (
                          <SelectItem key={`custom-${brand}`} value={brand}>
                            {brand} ⭐
                          </SelectItem>
                        ))}
                        {POPULAR_BRANDS.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Category Section */}
                <div className="md:col-span-2">
                  <Label htmlFor="ebay-category" className="text-xs mb-1.5 block">Category <span className="text-red-500">*</span></Label>
                  <div className="space-y-2">
                    {/* Breadcrumb navigation */}
                    {selectedCategoryPath.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategoryPath([]);
                            handleMarketplaceChange("ebay", "categoryId", "");
                            handleMarketplaceChange("ebay", "categoryName", "");
                          }}
                          className="hover:text-foreground underline"
                        >
                          Home
                        </button>
                        {selectedCategoryPath.map((cat, index) => (
                          <React.Fragment key={cat.categoryId}>
                            <span>/</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newPath = selectedCategoryPath.slice(0, index + 1);
                                setSelectedCategoryPath(newPath);
                                const lastCat = newPath[newPath.length - 1];
                                const fullPath = newPath.map(c => c.categoryName).join(" > ");
                                handleMarketplaceChange("ebay", "categoryId", lastCat.categoryId);
                                handleMarketplaceChange("ebay", "categoryName", fullPath);
                              }}
                              className="hover:text-foreground underline"
                            >
                              {cat.categoryName}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                    
                    {isLoadingCategoryTree || isLoadingCategories ? (
                      <div className="flex items-center gap-2 p-3 border rounded-md">
                        <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading categories...</span>
                      </div>
                    ) : categoriesError ? (
                      <div className="p-3 border rounded-md border-destructive/50 bg-destructive/10">
                        <p className="text-sm text-destructive">Error loading categories: {categoriesError.message}</p>
                        {categoriesError?.response?.details && (
                          <p className="text-xs text-destructive mt-2">
                            Details: {JSON.stringify(categoriesError.response.details)}
                          </p>
                        )}
                      </div>
                    ) : sortedCategories.length > 0 ? (
                      <Select
                        id="ebay-category"
                        name="ebay-category"
                        value={ebayForm.categoryId ? String(ebayForm.categoryId) : undefined}
                        onValueChange={(value) => {
                          const selectedCategory = sortedCategories.find(
                            cat => cat.category?.categoryId === value
                          );
                          
                          if (selectedCategory) {
                            const category = selectedCategory.category;
                            const newPath = [...selectedCategoryPath, {
                              categoryId: category.categoryId,
                              categoryName: category.categoryName,
                            }];
                            
                            // Check if this category has children
                            const hasChildren = selectedCategory.childCategoryTreeNodes && 
                              selectedCategory.childCategoryTreeNodes.length > 0 &&
                              !selectedCategory.leafCategoryTreeNode;
                            
                            if (hasChildren) {
                              // Navigate deeper into the tree
                              setSelectedCategoryPath(newPath);
                            } else {
                              // This is a leaf node - select it
                              const fullPath = newPath.map(c => c.categoryName).join(" > ");
                              handleMarketplaceChange("ebay", "categoryId", category.categoryId);
                              handleMarketplaceChange("ebay", "categoryName", fullPath);
                              setSelectedCategoryPath(newPath);
                            }
                          }
                        }}
                      >
                        <SelectTrigger id="ebay-category-trigger">
                          <SelectValue placeholder={selectedCategoryPath.length > 0 ? "Select subcategory" : "Select a category"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {sortedCategories.map((categoryNode) => {
                            const category = categoryNode.category;
                            if (!category || !category.categoryId) return null;
                            
                            const hasChildren = categoryNode.childCategoryTreeNodes && 
                              categoryNode.childCategoryTreeNodes.length > 0 &&
                              !categoryNode.leafCategoryTreeNode;
                            
                            return (
                              <SelectItem key={category.categoryId} value={category.categoryId}>
                                <div className="flex items-center gap-2">
                                  <span>{category.categoryName}</span>
                                  {hasChildren && (
                                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="p-3 border rounded-md">
                        <p className="text-sm text-muted-foreground">No subcategories available.</p>
                      </div>
                    )}
                    
                    {ebayForm.categoryName && (
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          Selected: {ebayForm.categoryName}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            handleMarketplaceChange("ebay", "categoryId", "");
                            handleMarketplaceChange("ebay", "categoryName", "");
                            setSelectedCategoryPath([]);
                          }}
                          className="h-6 px-2 text-xs"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Category Specifics Section - Always show when category is selected */}
                {ebayForm.categoryId && (
                  <div className="md:col-span-2 space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Category Specifics</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Reload category aspects
                          queryClient.invalidateQueries(['ebayCategoryAspects', categoryTreeId, ebayForm.categoryId]);
                        }}
                        className="gap-2 h-7 text-xs"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {/* Loading state */}
                    {isLoadingEbayAspects && (
                      <div className="flex items-center gap-2 p-3 border rounded-md mb-4">
                        <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading category specifics...</span>
                      </div>
                    )}

                    {/* Error state */}
                    {ebayAspectsError && !isLoadingEbayAspects && (
                      <div className="p-3 border rounded-md border-destructive/50 bg-destructive/10 mb-4">
                        <p className="text-sm text-destructive">Error loading category specifics: {ebayAspectsError.message}</p>
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer">Full error details</summary>
                          <pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(ebayAspectsError, null, 2)}</pre>
                        </details>
                      </div>
                    )}

                    {/* Show raw API response in debug mode when no aspects found */}
                    {process.env.NODE_ENV === 'development' && !isLoadingEbayAspects && !ebayAspectsError && ebayCategoryAspects.length === 0 && ebayCategoryAspectsData && (
                      <div className="p-3 border rounded-md border-orange-500/50 bg-orange-500/10 mb-4">
                        <p className="text-sm text-orange-600">⚠️ API returned data but no aspects were found. Raw response:</p>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs">View raw API response</summary>
                          <pre className="mt-1 text-xs whitespace-pre-wrap break-all">{JSON.stringify(ebayCategoryAspectsData, null, 2)}</pre>
                        </details>
                      </div>
                    )}

                    {/* Debug info - collapsed by default, only in development */}
                    {process.env.NODE_ENV === 'development' && !isLoadingEbayAspects && ebayForm.categoryId && (
                      <details className="text-xs text-muted-foreground p-2 bg-muted rounded mb-2">
                        <summary className="cursor-pointer font-medium">
                          🔍 Debug: Category Aspects ({ebayCategoryAspects.length} found)
                        </summary>
                        <div className="space-y-1 mt-2">
                          <div>Category ID: {ebayForm.categoryId}</div>
                          <div>Category Name: {ebayForm.categoryName}</div>
                          {ebayAspectsError && (
                            <div className="text-red-600">Error: {ebayAspectsError.message}</div>
                          )}
                          {!ebayAspectsError && ebayCategoryAspects.length > 0 && (
                            <>
                              <div className="mt-2">Aspects:</div>
                              {ebayCategoryAspects.map((a, idx) => (
                                <div key={idx} className="ml-2 text-xs">
                                  - {a.localizedAspectName || a.aspectName || a.name || 'Unknown'} 
                                  ({a.aspectValues?.length || 0} values)
                                  <details className="ml-2">
                                    <summary className="cursor-pointer text-blue-600">View data</summary>
                                    <pre className="text-xs mt-1 whitespace-pre-wrap break-all">{JSON.stringify(a, null, 2)}</pre>
                                  </details>
                                </div>
                              ))}
                              {ebayTypeAspect ? (
                                <div className="text-green-600">
                                  ✓ Model/Type aspect found: {ebayTypeAspect.localizedAspectName || ebayTypeAspect.aspectName || ebayTypeAspect.name} ({ebayTypeValues.length} values)
                                </div>
                              ) : (
                                <div className="text-orange-600">
                                  ✗ No Model/Type aspect found. Check console for full aspect data.
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </details>
                    )}
                    
                    {/* Type and Condition side by side */}
                    {!isLoadingEbayAspects && !ebayAspectsError && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Type/Model Field - Show if ebayTypeAspect exists (even if no values yet, to show loading state) */}
                        {ebayTypeAspect ? (
                          <div>
                            <Label className="text-xs mb-1.5 block">
                              {ebayTypeAspect.localizedAspectName} <span className="text-red-500">*</span>
                            </Label>
                            {ebayTypeValues.length > 0 ? (
                              <Select
                                value={ebayForm.itemType ? String(ebayForm.itemType) : undefined}
                                onValueChange={(value) => handleMarketplaceChange("ebay", "itemType", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={`Select ${ebayTypeAspect.localizedAspectName.toLowerCase()}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {ebayTypeValues.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="text-xs text-muted-foreground p-2 border rounded">
                                Loading {ebayTypeAspect.localizedAspectName.toLowerCase()} options...
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground p-2 border rounded">
                            No Model/Type aspect available for this category.
                          </div>
                        )}

                        {/* Condition Dropdown */}
                        <div>
                          <Label className="text-xs mb-1.5 block">
                            Condition <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={ebayForm.condition ? String(ebayForm.condition) : undefined}
                            onValueChange={(value) => handleMarketplaceChange("ebay", "condition", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="New">New</SelectItem>
                              <SelectItem value="Open Box">Open Box</SelectItem>
                              <SelectItem value="Used">Used</SelectItem>
                              <SelectItem value="For parts or not working">For parts or not working</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Condition Dropdown - Show when no category selected */}
                {!ebayForm.categoryId && (
                  <div>
                    <Label className="text-xs mb-1.5 block">
                      Condition <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={ebayForm.condition ? String(ebayForm.condition) : undefined}
                      onValueChange={(value) => handleMarketplaceChange("ebay", "condition", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="Open Box">Open Box</SelectItem>
                        <SelectItem value="Used">Used</SelectItem>
                        <SelectItem value="For parts or not working">For parts or not working</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* SKU Field */}
                <div>
                  <Label htmlFor="ebay-sku" className="text-xs mb-1.5 block">SKU</Label>
                  <Input
                    id="ebay-sku"
                    name="ebay-sku"
                    placeholder={generalForm.sku || "Enter SKU"}
                    value={ebayForm.sku || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "sku", e.target.value)}
                  />
                  {generalForm.sku && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited {generalForm.sku} from General form. You can edit this field.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Color <span className="text-red-500">*</span></Label>
                  <Button
                    type="button"
                    variant={ebayForm.color ? "default" : "outline"}
                    onClick={() => openColorPicker("ebay.color")}
                    className="w-full justify-start"
                  >
                    {ebayForm.color ? (
                      <>
                        <div
                          className="w-4 h-4 mr-2 rounded border border-gray-200 dark:border-gray-700 flex-shrink-0"
                          style={{ backgroundColor: getColorHex(ebayForm.color) || "#808080" }}
                        />
                        <span className="flex-1 text-left">{getColorName(ebayForm.color)}</span>
                      </>
                    ) : (
                      <>
                        <Palette className="w-4 h-4 mr-2" />
                        <span>Select color</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-xs mb-1.5 block">Pricing Format <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.pricingFormat ? String(ebayForm.pricingFormat) : undefined}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "pricingFormat", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Price</SelectItem>
                      <SelectItem value="auction">Auction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Duration <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.duration ? String(ebayForm.duration) : undefined}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "duration", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good 'Til Canceled">Good 'Til Canceled</SelectItem>
                      <SelectItem value="30 Days">30 Days</SelectItem>
                      <SelectItem value="7 Days">7 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Buy It Now Price <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={generalForm.price || "0.00"}
                    value={ebayForm.buyItNowPrice || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "buyItNowPrice", e.target.value)}
                  />
                  {generalForm.price && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited ${generalForm.price} from General form. You can edit this price.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Allow Best Offer</Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="ebay-best-offer"
                      checked={ebayForm.allowBestOffer}
                      onCheckedChange={(checked) => handleMarketplaceChange("ebay", "allowBestOffer", checked)}
                    />
                    <Label htmlFor="ebay-best-offer" className="text-sm">Allow buyers to submit offers</Label>
                  </div>
                </div>
              </div>

              {/* Save Default Button for Shipping Fields */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Save className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Shipping Settings</Label>
                </div>
                <div className="group relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveShippingDefaults}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                  <div className="absolute right-0 top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-50">
                    <div className="bg-popover text-popover-foreground text-xs px-2 py-1 rounded-md shadow-lg border whitespace-nowrap">
                      Save Default
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Method <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.shippingMethod ? String(ebayForm.shippingMethod) : undefined}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "shippingMethod", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard: Small to medium items">Standard: Small to medium items</SelectItem>
                      <SelectItem value="Local pickup only: Sell to buyer nears you">Local pickup only: Sell to buyer nears you</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Cost Type <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.shippingCostType ? String(ebayForm.shippingCostType) : undefined}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "shippingCostType", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Calculated: Cost varies based on buyer location">Calculated: Cost varies based on buyer location</SelectItem>
                      <SelectItem value="Flat: Same cost regardless of buyer location">Flat: Same cost regardless of buyer location</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Cost <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={ebayForm.shippingCost || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "shippingCost", e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Handling Time <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.handlingTime ? String(ebayForm.handlingTime) : undefined}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "handlingTime", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1 business day">1 business day</SelectItem>
                      <SelectItem value="2 business days">2 business days</SelectItem>
                      <SelectItem value="3 business days">3 business days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Ship From Country</Label>
                  <Select
                    value={ebayForm.shipFromCountry ? String(ebayForm.shipFromCountry) : "United States"}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "shipFromCountry", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Service <span className="text-red-500">*</span></Label>
                  <Select
                    value={ebayForm.shippingService ? String(ebayForm.shippingService) : undefined}
                    onValueChange={(value) => handleMarketplaceChange("ebay", "shippingService", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard Shipping (3 to 5 business days)">Standard Shipping (3 to 5 business days)</SelectItem>
                      <SelectItem value="Expedited Shipping (1 to 3 business days)">Expedited Shipping (1 to 3 business days)</SelectItem>
                      <SelectItem value="USPS Priority Mail">USPS Priority Mail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Location Descriptions</Label>
                  <Input
                    placeholder="(e.g., 'Spain')"
                    value={ebayForm.locationDescriptions || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "locationDescriptions", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Optional descriptive text shown to buyers (e.g., "Spain")
                  </p>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Shipping Location</Label>
                  <Input
                    placeholder={generalForm.zip || "Zip or region"}
                    value={ebayForm.shippingLocation || ""}
                    onChange={(e) => handleMarketplaceChange("ebay", "shippingLocation", e.target.value)}
                  />
                  {generalForm.zip && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited {generalForm.zip} from General form. You can edit this field.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Accept Returns <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="ebay-accept-returns"
                      checked={ebayForm.acceptReturns}
                      onCheckedChange={(checked) => handleMarketplaceChange("ebay", "acceptReturns", checked)}
                    />
                    <Label htmlFor="ebay-accept-returns" className="text-sm">Accept returns</Label>
                  </div>
                </div>
                
                {/* Return fields - shown when Accept Returns is enabled */}
                {ebayForm.acceptReturns && (
                  <>
                    <div>
                      <Label className="text-xs mb-1.5 block">Return Within <span className="text-red-500">*</span></Label>
                      <Select
                        value={ebayForm.returnWithin ? String(ebayForm.returnWithin) : "30 days"}
                        onValueChange={(value) => handleMarketplaceChange("ebay", "returnWithin", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30 days">30 days</SelectItem>
                          <SelectItem value="60 days">60 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5 block">Return Shipping Payer <span className="text-red-500">*</span></Label>
                      <Select
                        value={ebayForm.returnShippingPayer ? String(ebayForm.returnShippingPayer) : "Buyer"}
                        onValueChange={(value) => handleMarketplaceChange("ebay", "returnShippingPayer", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Buyer">Buyer</SelectItem>
                          <SelectItem value="Free for buyer, you pay">Free for buyer, you pay</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5 block">Return Refund Method <span className="text-red-500">*</span></Label>
                      <Select
                        value={ebayForm.returnRefundMethod ? String(ebayForm.returnRefundMethod) : "Full Refund"}
                        onValueChange={(value) => handleMarketplaceChange("ebay", "returnRefundMethod", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full Refund">Full Refund</SelectItem>
                          <SelectItem value="Full Refund or Replacement">Full Refund or Replacement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              {/* Package Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Package Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-xs mb-1.5 block">
                    Package Details <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant={generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight ? "default" : "outline"}
                    onClick={() => setPackageDetailsDialogOpen(true)}
                    className="w-full justify-start"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    {generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight
                      ? `${generalForm.packageWeight} lbs • ${generalForm.packageLength}" × ${generalForm.packageWidth}" × ${generalForm.packageHeight}"`
                      : "Enter weight & size"}
                  </Button>
                </div>
              </div>

              {/* eBay Listing Status - Show when item is listed */}
              {ebayListingId && (
                <div className="mt-6 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-green-600" />
                      <Label className="text-sm font-semibold">Listing Active</Label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1">eBay Listing ID</Label>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-background px-2 py-1 rounded border">{ebayListingId}</code>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          const url = getEbayItemUrl(ebayListingId);
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Listing
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        onClick={async () => {
                          if (!confirm('Are you sure you want to end this eBay listing? This action cannot be undone.')) {
                            return;
                          }
                          
                          try {
                            setIsSaving(true);
                            const response = await fetch('/api/ebay/listing', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                operation: 'EndItem',
                                itemId: ebayListingId,
                                userToken: ebayToken?.access_token,
                              }),
                            });

                            if (!response.ok) {
                              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                              throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
                            }

                            const result = await response.json();
                            
                            if (result.Ack === 'Success' || result.Ack === 'Warning') {
                              // Clear listing ID
                              setEbayListingId(null);
                              if (currentEditingItemId) {
                                localStorage.removeItem(`ebay_listing_${currentEditingItemId}`);
                              }
                              
                              // Update inventory item status
                              if (currentEditingItemId) {
                                try {
                                  await base44.entities.InventoryItem.update(currentEditingItemId, {
                                    status: 'available',
                                    ebay_listing_id: '',
                                  });
                                  queryClient.invalidateQueries(['inventoryItems']);
                                } catch (updateError) {
                                  console.error('Error updating inventory item:', updateError);
                                }
                              }

                              toast({
                                title: "Listing ended",
                                description: "Your eBay listing has been ended successfully.",
                              });
                            } else {
                              throw new Error(result.Errors?.join(', ') || 'Failed to end listing');
                            }
                          } catch (error) {
                            console.error('Error ending eBay listing:', error);
                            toast({
                              title: "Failed to end listing",
                              description: error.message || "An error occurred while ending the listing. Please try again.",
                              variant: "destructive",
                            });
                          } finally {
                            setIsSaving(false);
                          }
                        }}
                      >
                        <Unlock className="h-4 w-4" />
                        Delist
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {!ebayListingId && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => handleTemplateSave("ebay")}>
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                  <Button className="gap-2" onClick={() => handleListOnMarketplace("ebay")}>
                    List on eBay
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Etsy Form */}
          {activeForm === "etsy" && (
            <div className="space-y-6">
              {currentEditingItemId && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Item ID:</span>
                  <span className="text-sm text-muted-foreground font-mono">{currentEditingItemId}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Etsy listing profile</h3>
                  <p className="text-sm text-muted-foreground">
                    Etsy loves rich listings—processing time and "who made it" details are required.
                  </p>
                </div>
              </div>

              {/* Photos and Title Section */}
              <div className="space-y-6">
                {/* Photos Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item Photos</Label>
                    {(etsyForm.photos?.length > 0) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAllPhotos('etsy')}
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Delete All
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                    {/* Main Photo - spans 2 columns and 2 rows */}
                    {etsyForm.photos?.length > 0 && (
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", "0");
                          e.currentTarget.classList.add("opacity-50");
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          const dropIndex = 0;
                          if (dragIndex !== dropIndex) {
                            handlePhotoReorder(dragIndex, dropIndex, 'etsy');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-lg border-2 border-primary bg-muted cursor-move"
                      >
                        <img src={etsyForm.photos[0].preview || etsyForm.photos[0].imageUrl} alt={etsyForm.photos[0].fileName || "Main photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-1 left-1 inline-flex items-center justify-center rounded px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold uppercase">
                          Main
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(etsyForm.photos[0].id, 'etsy');
                          }}
                          className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    )}
                    
                    {/* Other Photos */}
                    {etsyForm.photos?.slice(1).map((photo, index) => (
                      <div
                        key={photo.id || index + 1}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(index + 1));
                          e.currentTarget.classList.add("opacity-50");
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          const dropIndex = index + 1;
                          if (dragIndex !== dropIndex) {
                            handlePhotoReorder(dragIndex, dropIndex, 'etsy');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted cursor-move hover:border-muted-foreground/60 transition"
                      >
                        <img src={photo.preview || photo.imageUrl} alt={photo.fileName || "Listing photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
                          <GripVertical className="h-4 w-4 md:h-6 md:w-6 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(photo.id, 'etsy');
                          }}
                          className="absolute top-1 right-1 inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    ))}
                    
                    {/* Add Photo Button - same size as photo tiles */}
                    {(etsyForm.photos?.length || 0) < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => etsyPhotoInputRef.current?.click()}
                        disabled={isUploadingPhotos}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                      >
                        <ImagePlus className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                        <span className="mt-1 text-[10px] md:text-xs font-medium text-muted-foreground">Add</span>
                      </button>
                    )}
                    <input
                      ref={etsyPhotoInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'etsy')}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Up to {MAX_PHOTOS} photos, {MAX_FILE_SIZE_MB}MB per photo. {etsyForm.photos?.length || 0}/{MAX_PHOTOS} used.
                    {isUploadingPhotos && <span className="ml-2 text-amber-600 dark:text-amber-400">Processing photos...</span>}
                  </p>
                </div>
              </div>

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Title Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Title</Label>
                  <Input
                    placeholder="Enter listing title"
                    value={etsyForm.title || ""}
                    onChange={(e) => handleMarketplaceChange("etsy", "title", e.target.value)}
                  />
                </div>

                {/* Description Section */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs">Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDescriptionGeneratorOpen(true)}
                      className="gap-2 h-7 text-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI Generate
                    </Button>
                  </div>
                  <RichTextarea
                    placeholder={generalForm.description ? `Inherited from General` : "Enter Etsy-specific description..."}
                    value={etsyForm.description || ""}
                    onChange={(e) => handleMarketplaceChange("etsy", "description", e.target.value)}
                    className="min-h-[120px]"
                  />
                  {generalForm.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>

                {/* Brand Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Brand</Label>
                  {brandIsCustom ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter brand name and press Enter to save"
                        value={etsyForm.brand || ""}
                        onChange={(e) => handleMarketplaceChange("etsy", "brand", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && etsyForm.brand?.trim()) {
                            e.preventDefault();
                            const savedBrand = addCustomBrand(etsyForm.brand);
                            if (savedBrand) {
                              setBrandIsCustom(false);
                            }
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => {
                          if (etsyForm.brand?.trim()) {
                            const savedBrand = addCustomBrand(etsyForm.brand);
                            if (savedBrand) {
                              setBrandIsCustom(false);
                            }
                          }
                        }}
                        disabled={!etsyForm.brand?.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBrandIsCustom(false);
                          handleMarketplaceChange("etsy", "brand", "");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={etsyForm.brand || generalForm.brand || undefined}
                      onValueChange={(value) => {
                        if (value === "custom") {
                          setBrandIsCustom(true);
                          handleMarketplaceChange("etsy", "brand", "");
                        } else {
                          handleMarketplaceChange("etsy", "brand", value);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={generalForm.brand ? `Inherited: ${generalForm.brand}` : "Select or Custom"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">+ Add Custom Brand</SelectItem>
                        {customBrands.length > 0 && customBrands.map((brand) => (
                          <SelectItem key={`custom-${brand}`} value={brand}>
                            {brand} ⭐
                          </SelectItem>
                        ))}
                        {POPULAR_BRANDS.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* SKU Field */}
                <div>
                  <Label className="text-xs mb-1.5 block">SKU</Label>
                  <Input
                    placeholder={generalForm.sku || "Enter SKU"}
                    value={etsyForm.sku || ""}
                    onChange={(e) => handleMarketplaceChange("etsy", "sku", e.target.value)}
                  />
                  {generalForm.sku && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited {generalForm.sku} from General form. You can edit this field.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1.5 block">Processing Time</Label>
                  <Select
                    value={etsyForm.processingTime}
                    onValueChange={(value) => handleMarketplaceChange("etsy", "processingTime", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-2 business days">1-2 business days</SelectItem>
                      <SelectItem value="1-3 business days">1-3 business days</SelectItem>
                      <SelectItem value="3-5 business days">3-5 business days</SelectItem>
                      <SelectItem value="1-2 weeks">1-2 weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Renewal Option</Label>
                  <Select
                    value={etsyForm.renewalOption}
                    onValueChange={(value) => handleMarketplaceChange("etsy", "renewalOption", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="automatic">Automatic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Who made it?</Label>
                  <Select
                    value={etsyForm.whoMade}
                    onValueChange={(value) => handleMarketplaceChange("etsy", "whoMade", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="i_did">I did</SelectItem>
                      <SelectItem value="collective">A member of my shop</SelectItem>
                      <SelectItem value="someone_else">Another company or person</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">When was it made?</Label>
                  <Select
                    value={etsyForm.whenMade}
                    onValueChange={(value) => handleMarketplaceChange("etsy", "whenMade", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2020s">2020s</SelectItem>
                      <SelectItem value="2010s">2010s</SelectItem>
                      <SelectItem value="2000s">2000s</SelectItem>
                      <SelectItem value="before_2000">Before 2000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Shipping Profile</Label>
                  <Input
                    placeholder="Link your saved Etsy shipping profile"
                    value={etsyForm.shippingProfile}
                    onChange={(e) => handleMarketplaceChange("etsy", "shippingProfile", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Tags</Label>
                  <TagInput
                    placeholder={etsyForm.inheritGeneral ? "Inherits general tags" : "Type keywords and press space or comma to add tags"}
                    value={etsyForm.tags}
                    onChange={(value) => handleMarketplaceChange("etsy", "tags", value)}
                    disabled={false}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Digital Download</Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="etsy-digital"
                      checked={etsyForm.isDigital}
                      onCheckedChange={(checked) => handleMarketplaceChange("etsy", "isDigital", checked)}
                    />
                    <Label htmlFor="etsy-digital" className="text-sm">This is a digital product</Label>
                  </div>
                </div>
              </div>

              {/* Package Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Package Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-xs mb-1.5 block">
                    Package Details <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant={generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight ? "default" : "outline"}
                    onClick={() => setPackageDetailsDialogOpen(true)}
                    className="w-full justify-start"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    {generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight
                      ? `${generalForm.packageWeight} lbs • ${generalForm.packageLength}" × ${generalForm.packageWidth}" × ${generalForm.packageHeight}"`
                      : "Enter weight & size"}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-muted-foreground/30 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4" />
                  Reconnect Etsy to refresh shipping profiles & shop policies.
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect("etsy")}>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect Etsy
                </Button>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2" onClick={() => handleTemplateSave("etsy")}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button className="gap-2" onClick={() => handleListOnMarketplace("etsy")}>
                  List on Etsy
                </Button>
              </div>
            </div>
          )}

          {/* Mercari Form */}
          {activeForm === "mercari" && (
            <div className="space-y-6">
              {currentEditingItemId && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Item ID:</span>
                  <span className="text-sm text-muted-foreground font-mono">{currentEditingItemId}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Mercari smart pricing</h3>
                  <p className="text-sm text-muted-foreground">
                    Control smart pricing and shipping preferences for Mercari listings.
                  </p>
                </div>
              </div>

              {/* Photos and Title Section */}
              <div className="space-y-6">
                {/* Photos Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item Photos</Label>
                    {(mercariForm.photos?.length > 0) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAllPhotos('mercari')}
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Delete All
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                    {/* Main Photo - spans 2 columns and 2 rows */}
                    {mercariForm.photos?.length > 0 && (
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", "0");
                          e.currentTarget.classList.add("opacity-50");
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          const dropIndex = 0;
                          if (dragIndex !== dropIndex) {
                            handlePhotoReorder(dragIndex, dropIndex, 'mercari');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-lg border-2 border-primary bg-muted cursor-move"
                      >
                        <img src={mercariForm.photos[0].preview || mercariForm.photos[0].imageUrl} alt={mercariForm.photos[0].fileName || "Main photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-1 left-1 inline-flex items-center justify-center rounded px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold uppercase">
                          Main
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(mercariForm.photos[0].id, 'mercari');
                          }}
                          className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    )}
                    
                    {/* Other Photos */}
                    {mercariForm.photos?.slice(1).map((photo, index) => (
                      <div
                        key={photo.id || index + 1}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(index + 1));
                          e.currentTarget.classList.add("opacity-50");
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          const dropIndex = index + 1;
                          if (dragIndex !== dropIndex) {
                            handlePhotoReorder(dragIndex, dropIndex, 'mercari');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted cursor-move hover:border-muted-foreground/60 transition"
                      >
                        <img src={photo.preview || photo.imageUrl} alt={photo.fileName || "Listing photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
                          <GripVertical className="h-4 w-4 md:h-6 md:w-6 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(photo.id, 'mercari');
                          }}
                          className="absolute top-1 right-1 inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    ))}
                    
                    {/* Add Photo Button - same size as photo tiles */}
                    {(mercariForm.photos?.length || 0) < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => mercariPhotoInputRef.current?.click()}
                        disabled={isUploadingPhotos}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                      >
                        <ImagePlus className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                        <span className="mt-1 text-[10px] md:text-xs font-medium text-muted-foreground">Add</span>
                      </button>
                    )}
                    <input
                      ref={mercariPhotoInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'mercari')}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Up to {MAX_PHOTOS} photos, {MAX_FILE_SIZE_MB}MB per photo. {mercariForm.photos?.length || 0}/{MAX_PHOTOS} used.
                    {isUploadingPhotos && <span className="ml-2 text-amber-600 dark:text-amber-400">Processing photos...</span>}
                  </p>
                </div>
              </div>

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Title Section */}
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Title <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder={generalForm.title ? `Inherited: ${generalForm.title}` : "What are you selling?"}
                    value={mercariForm.title || ""}
                    onChange={(e) => handleMarketplaceChange("mercari", "title", e.target.value)}
                  />
                  {generalForm.title && !mercariForm.title && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>

                {/* Description Section */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs">Description <span className="text-red-500">*</span></Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDescriptionGeneratorOpen(true)}
                      className="gap-2 h-7 text-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI Generate
                    </Button>
                  </div>
                  <RichTextarea
                    placeholder={generalForm.description ? `Inherited from General` : "Describe your item (5+ words)"}
                    value={mercariForm.description || ""}
                    onChange={(e) => handleMarketplaceChange("mercari", "description", e.target.value)}
                    className="min-h-[120px]"
                  />
                  {generalForm.description && !mercariForm.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>
              </div>

              {/* Category Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Category</Label>
                </div>
              </div>

              <div className="mb-6">
                <Label className="text-xs mb-1.5 block">Category <span className="text-red-500">*</span></Label>
                
                {/* Category breadcrumb */}
                {mercariCategoryPath.length > 0 && (
                  <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setMercariCategoryPath([]);
                        handleMarketplaceChange("mercari", "mercariCategory", "");
                        handleMarketplaceChange("mercari", "mercariCategoryId", "");
                      }}
                      className="hover:text-foreground underline"
                    >
                      Home
                    </button>
                    {mercariCategoryPath.map((cat, index) => (
                      <React.Fragment key={cat.id}>
                        <span>/</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newPath = mercariCategoryPath.slice(0, index + 1);
                            setMercariCategoryPath(newPath);
                            const fullPath = newPath.map(c => c.name).join(" > ");
                            handleMarketplaceChange("mercari", "mercariCategory", fullPath);
                            handleMarketplaceChange("mercari", "mercariCategoryId", newPath[newPath.length - 1].id);
                          }}
                          className="hover:text-foreground underline"
                        >
                          {cat.name}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                )}
                
                {/* Show selected category badge */}
                {mercariForm.mercariCategory && (
                  <div className="mb-2">
                    <Badge variant="secondary" className="text-xs">
                      Selected: {mercariForm.mercariCategory}
                    </Badge>
                  </div>
                )}
                
                {/* Mercari Category Dropdown - Multi-level */}
                <Select
                  value=""
                  onValueChange={(value) => {
                    // Get current level categories
                    let currentLevel = MERCARI_CATEGORIES;
                    
                    // Navigate to current path's subcategories
                    for (const pathItem of mercariCategoryPath) {
                      currentLevel = currentLevel[pathItem.id]?.subcategories || {};
                    }
                    
                    // Find selected category
                    const selected = currentLevel[value];
                    if (selected) {
                      const newPath = [...mercariCategoryPath, { id: selected.id, name: selected.name }];
                      
                      // Check if has subcategories
                      if (selected.subcategories && Object.keys(selected.subcategories).length > 0) {
                        // Has subcategories - navigate deeper
                        setMercariCategoryPath(newPath);
                      } else {
                        // Leaf node - select it
                        const fullPath = newPath.map(c => c.name).join(" > ");
                        handleMarketplaceChange("mercari", "mercariCategory", fullPath);
                        handleMarketplaceChange("mercari", "mercariCategoryId", selected.id);
                        setMercariCategoryPath(newPath);
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      mercariCategoryPath.length > 0 
                        ? `Select ${mercariCategoryPath[mercariCategoryPath.length - 1].name} subcategory...`
                        : "Select category"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      // Get categories for current level
                      let currentLevel = MERCARI_CATEGORIES;
                      
                      // Navigate to current path
                      for (const pathItem of mercariCategoryPath) {
                        currentLevel = currentLevel[pathItem.id]?.subcategories || {};
                      }
                      
                      // Render options
                      return Object.values(currentLevel).map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                          {cat.subcategories && Object.keys(cat.subcategories).length > 0 ? ' →' : ''}
                        </SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
                
                {/* Auto-suggest based on General form category */}
                {generalForm.category && !mercariForm.mercariCategory && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    💡 Suggested: 
                    {generalForm.category.toLowerCase().includes('women') || (generalForm.category.toLowerCase().includes('clothing') && !generalForm.category.toLowerCase().includes('men')) ? ' Women' : ''}
                    {generalForm.category.toLowerCase().includes('men') && !generalForm.category.toLowerCase().includes('women') ? ' Men' : ''}
                    {generalForm.category.toLowerCase().includes('electronic') ? ' Electronics' : ''}
                    {generalForm.category.toLowerCase().includes('toy') ? ' Toys & Collectibles' : ''}
                    {generalForm.category.toLowerCase().includes('home') || generalForm.category.toLowerCase().includes('furniture') ? ' Home' : ''}
                    {generalForm.category.toLowerCase().includes('beauty') ? ' Beauty' : ''}
                    {generalForm.category.toLowerCase().includes('kid') || generalForm.category.toLowerCase().includes('baby') ? ' Kids' : ''}
                    {generalForm.category.toLowerCase().includes('vintage') || generalForm.category.toLowerCase().includes('collectible') ? ' Vintage & collectibles' : ''}
                    {generalForm.category.toLowerCase().includes('sport') || generalForm.category.toLowerCase().includes('outdoor') || generalForm.category.toLowerCase().includes('grill') || generalForm.category.toLowerCase().includes('cooking') ? ' Sports & outdoors or Garden & Outdoor' : ''}
                    {generalForm.category.toLowerCase().includes('handmade') ? ' Handmade' : ''}
                    {generalForm.category.toLowerCase().includes('art') || generalForm.category.toLowerCase().includes('craft') ? ' Arts & Crafts' : ''}
                    {generalForm.category.toLowerCase().includes('pet') ? ' Pet Supplies' : ''}
                    {generalForm.category.toLowerCase().includes('garden') || generalForm.category.toLowerCase().includes('yard') ? ' Garden & Outdoor' : ''}
                    {generalForm.category.toLowerCase().includes('office') ? ' Office' : ''}
                    {generalForm.category.toLowerCase().includes('tool') ? ' Tools' : ''}
                    {generalForm.category.toLowerCase().includes('book') ? ' Books' : ''}
                  </p>
                )}

                {/* Size Field - Only shows for clothing/shoes/apparel categories */}
                {((mercariForm.category !== undefined ? mercariForm.category : generalForm.category)?.toLowerCase().includes('clothing') ||
                  (mercariForm.category !== undefined ? mercariForm.category : generalForm.category)?.toLowerCase().includes('shoes') ||
                  (mercariForm.category !== undefined ? mercariForm.category : generalForm.category)?.toLowerCase().includes('apparel') ||
                  (mercariForm.category !== undefined ? mercariForm.category : generalForm.category)?.toLowerCase().includes('men') ||
                  (mercariForm.category !== undefined ? mercariForm.category : generalForm.category)?.toLowerCase().includes('women') ||
                  (mercariForm.category !== undefined ? mercariForm.category : generalForm.category)?.toLowerCase().includes('kids')) && (
                  <div className="mt-4">
                    <Label className="text-xs mb-1.5 block">
                      Size <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder={generalForm.size ? `Inherited: ${generalForm.size}` : "e.g., M, L, XL, 32, 10"}
                      value={mercariForm.size || ""}
                      onChange={(e) => handleMarketplaceChange("mercari", "size", e.target.value)}
                      required
                    />
                    {generalForm.size && !mercariForm.size && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Inherited from General form. You can edit this field.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Brand Section - No custom brand for Mercari */}
                <div>
                  <Label className="text-xs mb-1.5 block">Brand</Label>
                  <Select
                    value={mercariForm.brand || generalForm.brand || ""}
                    onValueChange={(value) => handleMarketplaceChange("mercari", "brand", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={generalForm.brand ? `Inherited: ${generalForm.brand}` : "Select brand"} />
                    </SelectTrigger>
                    <SelectContent>
                      {customBrands.length > 0 && customBrands.map((brand) => (
                        <SelectItem key={`custom-${brand}`} value={brand}>
                          {brand} ⭐
                        </SelectItem>
                      ))}
                      {POPULAR_BRANDS.map((brand) => (
                        <SelectItem key={brand} value={brand}>
                          {brand}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {generalForm.brand && !mercariForm.brand && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited {generalForm.brand} from General form. You can edit this field.
                    </p>
                  )}
                </div>

                {/* Condition Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Condition <span className="text-red-500">*</span></Label>
                  <Select
                    value={mercariForm.condition || generalForm.condition || ""}
                    onValueChange={(value) => handleMarketplaceChange("mercari", "condition", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={generalForm.condition ? `Inherited: ${generalForm.condition}` : "Select condition"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Like New">Like New</SelectItem>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Fair">Fair</SelectItem>
                      <SelectItem value="Poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                  {generalForm.condition && !mercariForm.condition && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>

                {/* Color Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Color</Label>
                  <Select
                    value={mercariForm.color || generalForm.color || ""}
                    onValueChange={(value) => handleMarketplaceChange("mercari", "color", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={generalForm.color ? `Inherited: ${generalForm.color}` : "Select color (optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Black">Black</SelectItem>
                      <SelectItem value="White">White</SelectItem>
                      <SelectItem value="Gray">Gray</SelectItem>
                      <SelectItem value="Brown">Brown</SelectItem>
                      <SelectItem value="Beige">Beige</SelectItem>
                      <SelectItem value="Red">Red</SelectItem>
                      <SelectItem value="Pink">Pink</SelectItem>
                      <SelectItem value="Orange">Orange</SelectItem>
                      <SelectItem value="Yellow">Yellow</SelectItem>
                      <SelectItem value="Green">Green</SelectItem>
                      <SelectItem value="Blue">Blue</SelectItem>
                      <SelectItem value="Purple">Purple</SelectItem>
                      <SelectItem value="Gold">Gold</SelectItem>
                      <SelectItem value="Silver">Silver</SelectItem>
                      <SelectItem value="Multi-Color">Multi-Color</SelectItem>
                    </SelectContent>
                  </Select>
                  {generalForm.color && !mercariForm.color && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>

              </div>

              {/* Pricing & Inventory Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Pricing & Inventory</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Listing Price */}
                <div>
                  <Label className="text-xs mb-1.5 block">Listing Price <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    placeholder={generalForm.price ? `Inherited: $${generalForm.price}` : "(min $1/max $2000)"}
                    value={mercariForm.price || ""}
                    onChange={(e) => handleMarketplaceChange("mercari", "price", e.target.value)}
                    className="text-right"
                  />
                  {generalForm.price && !mercariForm.price && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>

                {/* Quantity */}
                <div>
                  <Label className="text-xs mb-1.5 block">Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder={generalForm.quantity ? `Inherited: ${generalForm.quantity}` : "1"}
                    value={mercariForm.quantity || ""}
                    onChange={(e) => handleMarketplaceChange("mercari", "quantity", e.target.value)}
                  />
                  {generalForm.quantity && !mercariForm.quantity && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>
              </div>

              {/* Shipping Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Shipping</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Ships From (Zip Code) */}
                <div>
                  <Label className="text-xs mb-1.5 block">Ships From (Zip Code) <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Enter your zip code"
                    value={mercariForm.shipsFrom || ""}
                    onChange={(e) => handleMarketplaceChange("mercari", "shipsFrom", e.target.value)}
                    maxLength={5}
                  />
                </div>

                {/* Delivery Method */}
                <div>
                  <Label className="text-xs mb-1.5 block">Delivery Method <span className="text-red-500">*</span></Label>
                  <Select
                    value={mercariForm.deliveryMethod || "prepaid"}
                    onValueChange={(value) => handleMarketplaceChange("mercari", "deliveryMethod", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prepaid">Mercari Prepaid Label</SelectItem>
                      <SelectItem value="ship_on_own">Ship on Your Own</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>


              <div className="flex flex-col gap-3 rounded-lg border border-muted-foreground/30 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4" />
                  Update Mercari connection to sync latest shipping labels & rates.
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect("mercari")}>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect Mercari
                </Button>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2" onClick={() => handleTemplateSave("mercari")}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button className="gap-2" onClick={() => handleListOnMarketplace("mercari")}>
                  List on Mercari
                </Button>
              </div>
            </div>
          )}

          {/* Facebook Form */}
          {activeForm === "facebook" && (
            <div className="space-y-6">
              {currentEditingItemId && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md border">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Item ID:</span>
                  <span className="text-sm text-muted-foreground font-mono">{currentEditingItemId}</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Facebook Marketplace</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure shipping vs pickup defaults and whether offers are allowed.
                  </p>
                </div>
              </div>

              {/* Photos and Title Section */}
              <div className="space-y-6">
                {/* Photos Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Item Photos</Label>
                    {(facebookForm.photos?.length > 0) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAllPhotos('facebook')}
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Delete All
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-4 md:grid-cols-6 gap-3 auto-rows-fr">
                    {/* Main Photo - spans 2 columns and 2 rows */}
                    {facebookForm.photos?.length > 0 && (
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", "0");
                          e.currentTarget.classList.add("opacity-50");
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          const dropIndex = 0;
                          if (dragIndex !== dropIndex) {
                            handlePhotoReorder(dragIndex, dropIndex, 'facebook');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative col-span-2 row-span-2 aspect-square overflow-hidden rounded-lg border-2 border-primary bg-muted cursor-move"
                      >
                        <img src={facebookForm.photos[0].preview || facebookForm.photos[0].imageUrl} alt={facebookForm.photos[0].fileName || "Main photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-1 left-1 inline-flex items-center justify-center rounded px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold uppercase">
                          Main
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(facebookForm.photos[0].id, 'facebook');
                          }}
                          className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    )}
                    
                    {/* Other Photos */}
                    {facebookForm.photos?.slice(1).map((photo, index) => (
                      <div
                        key={photo.id || index + 1}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(index + 1));
                          e.currentTarget.classList.add("opacity-50");
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          const dropIndex = index + 1;
                          if (dragIndex !== dropIndex) {
                            handlePhotoReorder(dragIndex, dropIndex, 'facebook');
                          }
                          e.currentTarget.classList.remove("opacity-50");
                        }}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 bg-muted cursor-move hover:border-muted-foreground/60 transition"
                      >
                        <img src={photo.preview || photo.imageUrl} alt={photo.fileName || "Listing photo"} className="h-full w-full object-cover" />
                        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
                          <GripVertical className="h-4 w-4 md:h-6 md:w-6 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePhotoRemove(photo.id, 'facebook');
                          }}
                          className="absolute top-1 right-1 inline-flex h-5 w-5 md:h-6 md:w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 z-10"
                        >
                          <X className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="sr-only">Remove photo</span>
                        </button>
                      </div>
                    ))}
                    
                    {/* Add Photo Button - same size as photo tiles */}
                    {(facebookForm.photos?.length || 0) < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => facebookPhotoInputRef.current?.click()}
                        disabled={isUploadingPhotos}
                        className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
                      >
                        <ImagePlus className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                        <span className="mt-1 text-[10px] md:text-xs font-medium text-muted-foreground">Add</span>
                      </button>
                    )}
                    <input
                      ref={facebookPhotoInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'facebook')}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Up to {MAX_PHOTOS} photos, {MAX_FILE_SIZE_MB}MB per photo. {facebookForm.photos?.length || 0}/{MAX_PHOTOS} used.
                    {isUploadingPhotos && <span className="ml-2 text-amber-600 dark:text-amber-400">Processing photos...</span>}
                  </p>
                </div>
              </div>

              {/* Item Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Item Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Title Section */}
                <div>
                  <Label className="text-xs mb-1.5 block">Title</Label>
                  <Input
                    placeholder="Enter listing title"
                    value={facebookForm.title || ""}
                    onChange={(e) => handleMarketplaceChange("facebook", "title", e.target.value)}
                  />
                </div>

                {/* Description Section */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs">Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDescriptionGeneratorOpen(true)}
                      className="gap-2 h-7 text-xs"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI Generate
                    </Button>
                  </div>
                  <RichTextarea
                    placeholder={generalForm.description ? `Inherited from General` : "Enter Facebook-specific description..."}
                    value={facebookForm.description || ""}
                    onChange={(e) => handleMarketplaceChange("facebook", "description", e.target.value)}
                    className="min-h-[120px]"
                  />
                  {generalForm.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form. You can edit this field.
                    </p>
                  )}
                </div>
              </div>

              {/* Category Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Category</Label>
                </div>
              </div>

              <div className="mb-6">
                <Label className="text-xs mb-1.5 block">
                  Category <span className="text-red-500">*</span>
                </Label>
                
                {/* Breadcrumb navigation for category path */}
                {generalCategoryPath.length > 0 && (
                  <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setGeneralCategoryPath([]);
                        handleMarketplaceChange("facebook", "category", "");
                        handleMarketplaceChange("facebook", "categoryId", "");
                      }}
                      className="hover:text-foreground underline"
                    >
                      Home
                    </button>
                    {generalCategoryPath.map((cat, index) => (
                      <React.Fragment key={cat.categoryId}>
                        <span>/</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newPath = generalCategoryPath.slice(0, index + 1);
                            setGeneralCategoryPath(newPath);
                            const lastCat = newPath[newPath.length - 1];
                            const fullPath = newPath.map(c => c.categoryName).join(" > ");
                            handleMarketplaceChange("facebook", "category", fullPath);
                            if (lastCat?.categoryId) {
                              handleMarketplaceChange("facebook", "categoryId", lastCat.categoryId);
                            }
                          }}
                          className="hover:text-foreground underline"
                        >
                          {cat.categoryName}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                )}
                
                {/* Show selected category badge */}
                {((facebookForm.category !== undefined ? facebookForm.category : generalForm.category) || generalCategoryPath.length > 0) && (
                  <div className="mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Selected: {facebookForm.category !== undefined ? facebookForm.category : generalForm.category}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleMarketplaceChange("facebook", "category", "");
                          handleMarketplaceChange("facebook", "categoryId", "");
                          setGeneralCategoryPath([]);
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Category Dropdown - Inherits from General or allows selection */}
                {!isLoadingCategoryTree && categoryTreeId ? (
                  generalCategoryPath.length > 0 && sortedCategories.length === 0 ? (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-md">
                      <p className="text-sm text-green-700 dark:text-green-400">
                        ✓ Category selected: {facebookForm.category || generalForm.category}
                      </p>
                    </div>
                  ) : sortedCategories.length > 0 ? (
                    <Select
                      value={undefined}
                      onValueChange={(value) => {
                        const selectedCategory = sortedCategories.find(
                          cat => cat.category?.categoryId === value
                        );
                        
                        if (selectedCategory) {
                          const category = selectedCategory.category;
                          const newPath = [...generalCategoryPath, {
                            categoryId: category.categoryId,
                            categoryName: category.categoryName,
                          }];
                          
                          // Check if this category has children
                          const hasChildren = selectedCategory.childCategoryTreeNodes && 
                            selectedCategory.childCategoryTreeNodes.length > 0 &&
                            !selectedCategory.leafCategoryTreeNode;
                          
                          if (hasChildren) {
                            // Navigate deeper into the tree
                            setGeneralCategoryPath(newPath);
                          } else {
                            // This is a leaf node - select it
                            const fullPath = newPath.map(c => c.categoryName).join(" > ");
                            const categoryId = category.categoryId;
                            handleMarketplaceChange("facebook", "category", fullPath);
                            handleMarketplaceChange("facebook", "categoryId", categoryId);
                            setGeneralCategoryPath(newPath);
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={generalCategoryPath.length > 0 ? "Select subcategory" : "Select a category"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {sortedCategories.map((categoryNode) => {
                          const category = categoryNode.category;
                          if (!category || !category.categoryId) return null;
                          
                          const hasChildren = categoryNode.childCategoryTreeNodes && 
                            categoryNode.childCategoryTreeNodes.length > 0 &&
                            !categoryNode.leafCategoryTreeNode;
                          
                          return (
                            <SelectItem key={category.categoryId} value={category.categoryId}>
                              {category.categoryName} {hasChildren && '›'}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-3 bg-muted/50 border rounded-md text-sm text-muted-foreground">
                      {generalForm.category 
                        ? `Using category from General: ${generalForm.category}`
                        : 'Loading categories...'}
                    </div>
                  )
                ) : (
                  <div className="p-3 bg-muted/50 border rounded-md text-sm text-muted-foreground">
                    {generalForm.category 
                      ? `Inherited from General: ${generalForm.category}`
                      : 'Category tree loading...'}
                  </div>
                )}
              </div>

              {/* Category Specifics - Show when category is selected */}
              {(facebookForm.category || generalForm.category || facebookForm.categoryId || generalForm.categoryId) && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium">Category Specifics</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Refresh category specifics
                        toast({
                          title: "Refreshed",
                          description: "Category specifics updated",
                        });
                      }}
                      className="h-6 px-2"
                      title="Refresh category specifics"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Condition - Always show */}
                    <div>
                      <Label className="text-xs mb-1.5 block">
                        Condition <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={facebookForm.condition || generalForm.condition || undefined}
                        onValueChange={(value) => handleMarketplaceChange("facebook", "condition", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={generalForm.condition ? `Inherited: ${generalForm.condition}` : "Select condition"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="used_like_new">Used - Like New</SelectItem>
                          <SelectItem value="used_good">Used - Good</SelectItem>
                          <SelectItem value="used_fair">Used - Fair</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Size - Show for clothing/shoes categories */}
                    {(facebookForm.category?.toLowerCase().includes('clothing') || 
                      facebookForm.category?.toLowerCase().includes('shoes') ||
                      facebookForm.category?.toLowerCase().includes('apparel') ||
                      generalForm.category?.toLowerCase().includes('clothing') ||
                      generalForm.category?.toLowerCase().includes('shoes') ||
                      generalForm.category?.toLowerCase().includes('apparel')) && (
                      <div>
                        <Label className="text-xs mb-1.5 block">
                          Size <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          placeholder={generalForm.size ? `Inherited: ${generalForm.size}` : "Enter size (e.g., M, L, XL, 10, 42)"}
                          value={facebookForm.size || ""}
                          onChange={(e) => handleMarketplaceChange("facebook", "size", e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Show More Details Button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFacebookMoreDetails(!showFacebookMoreDetails)}
                    className="mt-4 mb-4"
                  >
                    {showFacebookMoreDetails ? 'Hide Optional Details' : 'Show More Details'}
                  </Button>

                  {/* Optional Details - Show when toggled */}
                  {showFacebookMoreDetails && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-md border">
                      {/* Brand */}
                      <div>
                        <Label className="text-xs mb-1.5 block">Brand</Label>
                        {brandIsCustom ? (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter brand and press Enter"
                              value={facebookForm.brand || ""}
                              onChange={(e) => handleMarketplaceChange("facebook", "brand", e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && facebookForm.brand?.trim()) {
                                  e.preventDefault();
                                  addCustomBrand(facebookForm.brand);
                                  setBrandIsCustom(false);
                                }
                              }}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setBrandIsCustom(false);
                                handleMarketplaceChange("facebook", "brand", "");
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Select
                            value={facebookForm.brand || generalForm.brand || undefined}
                            onValueChange={(value) => {
                              if (value === "custom") {
                                setBrandIsCustom(true);
                                handleMarketplaceChange("facebook", "brand", "");
                              } else {
                                handleMarketplaceChange("facebook", "brand", value);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select brand" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="custom">+ Add Custom Brand</SelectItem>
                              {customBrands.map((brand) => (
                                <SelectItem key={`custom-${brand}`} value={brand}>
                                  {brand} ⭐
                                </SelectItem>
                              ))}
                              {POPULAR_BRANDS.map((brand) => (
                                <SelectItem key={brand} value={brand}>
                                  {brand}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Type */}
                      <div>
                        <Label className="text-xs mb-1.5 block">Type</Label>
                        <Input
                          placeholder="e.g., DSLR, Point & Shoot, Mirrorless"
                          value={facebookForm.itemType || ""}
                          onChange={(e) => handleMarketplaceChange("facebook", "itemType", e.target.value)}
                        />
                      </div>

                      {/* Color */}
                      <div>
                        <Label className="text-xs mb-1.5 block">Color</Label>
                        <Input
                          placeholder={generalForm.color1 ? `Inherited: ${generalForm.color1}` : "Primary color"}
                          value={facebookForm.color || ""}
                          onChange={(e) => handleMarketplaceChange("facebook", "color", e.target.value)}
                        />
                      </div>

                      {/* Additional category-specific field examples */}
                      {facebookForm.category?.toLowerCase().includes('camera') && (
                        <div>
                          <Label className="text-xs mb-1.5 block">Camera Megapixels</Label>
                          <Input
                            placeholder="e.g., 24 MP"
                            value={facebookForm.megapixels || ""}
                            onChange={(e) => handleMarketplaceChange("facebook", "megapixels", e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Pricing and Quantity Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Pricing & Inventory</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Listing Price */}
                <div>
                  <Label className="text-xs mb-1.5 block">
                    Listing Price <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder={generalForm.price ? `Inherited: $${generalForm.price}` : "Enter price"}
                    value={facebookForm.price || ""}
                    onChange={(e) => handleMarketplaceChange("facebook", "price", e.target.value)}
                  />
                  {generalForm.price && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited ${generalForm.price} from General form
                    </p>
                  )}
                </div>

                {/* Quantity */}
                <div>
                  <Label className="text-xs mb-1.5 block">
                    Quantity <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder={generalForm.quantity ? `Inherited: ${generalForm.quantity}` : "1"}
                    value={facebookForm.quantity || ""}
                    onChange={(e) => handleMarketplaceChange("facebook", "quantity", e.target.value)}
                  />
                  {generalForm.quantity && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited from General form
                    </p>
                  )}
                </div>
              </div>

              {/* Shipping Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Shipping & Pickup</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-1.5 block">Delivery Method</Label>
                  <Select
                    value={facebookForm.deliveryMethod}
                    onValueChange={(value) => handleMarketplaceChange("facebook", "deliveryMethod", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shipping_and_pickup">Shipping & Local Pickup</SelectItem>
                      <SelectItem value="shipping_only">Shipping Only</SelectItem>
                      <SelectItem value="pickup_only">Pickup Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Flat Shipping Price</Label>
                  <Input
                    placeholder="Optional override"
                    value={facebookForm.shippingPrice}
                    onChange={(e) => handleMarketplaceChange("facebook", "shippingPrice", e.target.value)}
                    disabled={false}
                  />
                  {facebookForm.inheritGeneral && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Uses General pricing when sync is enabled.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Meetup Location</Label>
                  <Input
                    placeholder={generalForm.zip ? `Inherited from General: ${generalForm.zip}` : "Preferred meetup details"}
                    value={facebookForm.meetUpLocation}
                    onChange={(e) => handleMarketplaceChange("facebook", "meetUpLocation", e.target.value)}
                  />
                  {generalForm.zip && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Inherited {generalForm.zip} from General form. You can edit this field.
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Allow Offers</Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="facebook-allow-offers"
                      checked={facebookForm.allowOffers}
                      onCheckedChange={(checked) => handleMarketplaceChange("facebook", "allowOffers", checked)}
                    />
                    <Label htmlFor="facebook-allow-offers" className="text-sm">Allow Messenger offers</Label>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Local Pickup</Label>
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="facebook-local-pickup"
                      checked={facebookForm.localPickup}
                      onCheckedChange={(checked) => handleMarketplaceChange("facebook", "localPickup", checked)}
                    />
                    <Label htmlFor="facebook-local-pickup" className="text-sm">Offer local pickup</Label>
                  </div>
                </div>
              </div>

              {/* Additional Options Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Additional Options</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Tags */}
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">Tags</Label>
                  <Input
                    placeholder={generalForm.tags ? `Inherited: ${generalForm.tags}` : "Comma-separated tags (e.g., vintage, luxury, gift)"}
                    value={facebookForm.tags || ""}
                    onChange={(e) => handleMarketplaceChange("facebook", "tags", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use up to 20 tags someone might search for
                  </p>
                </div>

                {/* SKU */}
                <div className="md:col-span-2">
                  <Label className="text-xs mb-1.5 block">SKU</Label>
                  <Input
                    placeholder={generalForm.sku ? `Inherited: ${generalForm.sku}` : "Internal SKU (optional)"}
                    value={facebookForm.sku || ""}
                    onChange={(e) => handleMarketplaceChange("facebook", "sku", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Only visible to you
                  </p>
                </div>
              </div>

              {/* Privacy Settings Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Privacy Settings</Label>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/40 px-3 py-3">
                  <Switch
                    id="facebook-hide-from-friends"
                    checked={facebookForm.hideFromFriends}
                    onCheckedChange={(checked) => handleMarketplaceChange("facebook", "hideFromFriends", checked)}
                  />
                  <div>
                    <Label htmlFor="facebook-hide-from-friends" className="text-sm cursor-pointer">Hide from friends</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This listing will be hidden from your Facebook friends but visible to other people on Facebook
                    </p>
                  </div>
                </div>
              </div>

              {/* Package Details Section */}
              <div className="flex items-center justify-between pb-2 border-b mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Package Details</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-xs mb-1.5 block">
                    Package Details <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant={generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight ? "default" : "outline"}
                    onClick={() => setPackageDetailsDialogOpen(true)}
                    className="w-full justify-start"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    {generalForm.packageWeight && generalForm.packageLength && generalForm.packageWidth && generalForm.packageHeight
                      ? `${generalForm.packageWeight} lbs • ${generalForm.packageLength}" × ${generalForm.packageWidth}" × ${generalForm.packageHeight}"`
                      : "Enter weight & size"}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-muted-foreground/30 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4" />
                  Reconnect Facebook to refresh shipping policies & payout options.
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => handleReconnect("facebook")}>
                  <RefreshCw className="h-4 w-4" />
                  Reconnect Facebook
                </Button>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2" onClick={() => handleTemplateSave("facebook")}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button className="gap-2" onClick={() => handleListOnMarketplace("facebook")}>
                  List on Facebook
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center gap-4 pt-6 border-t">
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl("Crosslist"))}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Package Details Dialog */}
      <Dialog open={packageDetailsDialogOpen} onOpenChange={setPackageDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Package Details</DialogTitle>
            <DialogDescription>
              Enter the package weight and dimensions. This information is required.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="package-weight" className="text-sm font-medium">
                Weight (lbs) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="package-weight"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={generalForm.packageWeight}
                onChange={(e) => handleGeneralChange("packageWeight", e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="package-length" className="text-sm font-medium">
                  Length (in) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="package-length"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={generalForm.packageLength}
                  onChange={(e) => handleGeneralChange("packageLength", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="package-width" className="text-sm font-medium">
                  Width (in) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="package-width"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={generalForm.packageWidth}
                  onChange={(e) => handleGeneralChange("packageWidth", e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="package-height" className="text-sm font-medium">
                  Height (in) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="package-height"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={generalForm.packageHeight}
                  onChange={(e) => handleGeneralChange("packageHeight", e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="package-notes" className="text-sm font-medium">
                Additional Notes (Optional)
              </Label>
              <Textarea
                id="package-notes"
                placeholder="Fragile, special handling instructions, etc."
                value={generalForm.packageDetails}
                onChange={(e) => handleGeneralChange("packageDetails", e.target.value)}
                className="mt-1.5 min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPackageDetailsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => setPackageDetailsDialogOpen(false)}
              disabled={!generalForm.packageWeight || !generalForm.packageLength || !generalForm.packageWidth || !generalForm.packageHeight}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Color Picker Dialog */}
      <ColorPickerDialog
        open={colorPickerOpen}
        onOpenChange={setColorPickerOpen}
        currentColor={editingColorField === "color1" ? generalForm.color1 : editingColorField === "color2" ? generalForm.color2 : editingColorField === "ebay.color" ? ebayForm.color : ""}
        onSelectColor={handleColorSelect}
        fieldLabel={
          editingColorField === "color1" ? "Primary Color" : 
          editingColorField === "color2" ? "Secondary Color" :
          editingColorField === "ebay.color" ? "Color" : "Color"
        }
      />

      {/* Description Generator Dialog */}
      <DescriptionGenerator
        open={descriptionGeneratorOpen}
        onOpenChange={setDescriptionGeneratorOpen}
        onSelectDescription={(description) => {
          if (activeForm === "general") {
            handleGeneralChange("description", description);
          } else {
            handleMarketplaceChange(activeForm, "description", description);
          }
        }}
        title={activeForm === "general" ? generalForm.title : templateForms[activeForm]?.title || generalForm.title}
        brand={activeForm === "general" ? generalForm.brand : templateForms[activeForm]?.brand || generalForm.brand}
        category={activeForm === "general" ? generalForm.category : generalForm.category}
        condition={activeForm === "general" ? generalForm.condition : generalForm.condition}
        similarDescriptions={similarItems}
      />

      {/* Image Editor */}
      <ImageEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        imageSrc={imageToEdit.url}
        onSave={handleSaveEditedImage}
        fileName={`${imageToEdit.marketplace}-${imageToEdit.photoId || 'photo'}-edited.jpg`}
        allImages={
          imageToEdit.marketplace === 'general' 
            ? (templateForms.general?.photos || []).map(p => p.preview || p.imageUrl || p.url)
            : (templateForms[imageToEdit.marketplace]?.photos || []).map(p => p.preview || p.imageUrl || p.url)
        }
        onApplyToAll={handleApplyFiltersToAll}
        itemId={currentEditingItemId || `temp_${imageToEdit.marketplace}`}
      />

      {/* Sold Lookup Dialog */}
      <SoldLookupDialog
        open={soldDialogOpen}
        onOpenChange={setSoldDialogOpen}
        itemName={generalForm.title || ""}
        onEbaySearch={() => {
          setEbaySearchInitialQuery(generalForm.title || "");
          setSoldDialogOpen(false);
          setEbaySearchDialogOpen(true);
        }}
      />

      {/* eBay Search Dialog */}
      <EbaySearchDialog
        open={ebaySearchDialogOpen}
        onOpenChange={setEbaySearchDialogOpen}
        onSelectItem={handleEbayItemSelect}
        initialSearchQuery={ebaySearchInitialQuery}
      />
    </div>
  );
}

