import streamlit as st
import random
import json
import os

# ==========================================
# 1. 홈 화면 페이지
# ==========================================
def home_page():
    st.title("🌟 환영합니다! 나만의 첫 웹 페이지입니다.")
    st.subheader("스트림릿(Streamlit)으로 만든 멋진 첫 화면에 오신 것을 환영해요!")
    st.divider()
    
    col1, col2 = st.columns(2)
    with col1:
        st.write("### 💡 이 앱에 대하여")
        st.write("""
        이곳에는 웹페이지의 소개글이나 사용 방법을 적을 수 있어.
        스트림릿은 복잡한 HTML이나 CSS 없이 파이썬만으로도 
        이렇게 훌륭한 UI를 만들 수 있게 해 주는 아주 강력한 도구야.
        """)
    with col2:
        st.write("### 🛠️ 기능 테스트")
        st.write("간단한 버튼과 입력창을 테스트해 볼 수 있어.")
        user_name = st.text_input("이름을 입력해 보세요!")
        if st.button("인사하기"):
            if user_name:
                st.success(f"반가워요, {user_name}님! 멋진 프로그래밍을 응원할게요!")
            else:
                st.warning("이름을 먼저 입력해 주세요.")

# ==========================================
# 2. 업다운 게임 페이지
# ==========================================
def game_page():
    st.title("🎮 업다운(Up-Down) 게임")
    st.write("컴퓨터가 1부터 100 사이의 숫자 하나를 생각했습니다. 맞춰보세요!")

    if "target_number" not in st.session_state:
        st.session_state.target_number = random.randint(1, 100)
        st.session_state.game_over = False
        st.session_state.attempts = 0

    with st.form(key="updown_form", clear_on_submit=False):
        user_input = st.text_input("숫자를 입력하고 엔터를 누르세요 (1~100)")
        submit_button = st.form_submit_button(label="정답 확인")

    if submit_button:
        if user_input.isdigit():
            user_guess = int(user_input)
            
            if not st.session_state.game_over:
                st.session_state.attempts += 1
                
                if user_guess < st.session_state.target_number:
                    st.info(f"🔺 UP! 컴퓨터가 생각한 숫자가 더 큽니다. (시도 횟수: {st.session_state.attempts}회)")
                elif user_guess > st.session_state.target_number:
                    st.info(f"🔻 DOWN! 컴퓨터가 생각한 숫자가 더 작습니다. (시도 횟수: {st.session_state.attempts}회)")
                else:
                    st.success(f"🎉 정답입니다! {st.session_state.attempts}번 만에 맞추셨습니다!")
                    st.session_state.game_over = True
            else:
                st.warning("게임이 끝났습니다. 새로운 게임을 시작하려면 아래 재시작 버튼을 눌러주세요.")
        else:
            st.error("숫자만 정확하게 입력해 주세요!")

    if st.button("게임 재시작"):
        st.session_state.target_number = random.randint(1, 100)
        st.session_state.game_over = False
        st.session_state.attempts = 0
        st.rerun()

# ==========================================
# 3. 뱀사다리 말판 게임 페이지
# ==========================================
def board_page():
    st.title("🎲 뱀사다리 말판 게임 (1~50)")
    st.write("주사위를 굴려 가장 먼저 50번 칸에 도착하는 사람이 승리합니다!")
    
    ladders = {3: 15, 12: 28, 20: 34, 31: 43}
    snakes = {18: 6, 32: 10, 41: 25, 48: 22}
    emojis = ["🔴", "🔵", "🟡", "🟢"]

    if "board_players" not in st.session_state:
        st.session_state.board_players = 2
    if "positions" not in st.session_state:
        st.session_state.positions = [1, 1, 1, 1]
    if "turn" not in st.session_state:
        st.session_state.turn = 0
    if "log" not in st.session_state:
        st.session_state.log = ["게임을 시작합니다!"]
    if "winner" not in st.session_state:
        st.session_state.winner = None
    if "custom_names" not in st.session_state:
        st.session_state.custom_names = ["플레이어 1", "플레이어 2", "플레이어 3", "플레이어 4"]

    st.subheader("👥 게임 인원 및 이름 설정")
    new_num_players = st.selectbox("참여할 플레이어 수를 선택하세요", [2, 3, 4], index=st.session_state.board_players - 2, key="board_p_select")
    
    if new_num_players != st.session_state.board_players:
        st.session_state.board_players = new_num_players
        st.session_state.positions = [1, 1, 1, 1]
        st.session_state.turn = 0
        st.session_state.log = ["인원이 변경되어 게임을 리셋합니다!"]
        st.session_state.winner = None
        st.rerun()

    name_cols = st.columns(st.session_state.board_players)
    for i in range(st.session_state.board_players):
        with name_cols[i]:
            st.session_state.custom_names[i] = st.text_input(f"{emojis[i]} 이름 입력", value=st.session_state.custom_names[i], key=f"p_name_{i}")

    display_names = [f"{emojis[i]} {st.session_state.custom_names[i]}" for i in range(st.session_state.board_players)]

    st.divider()

    st.subheader("🗺️ 실시간 게임 보드판")
    board_html = "<div style='display: grid; grid-template-columns: repeat(10, 1fr); gap: 6px; background-color: #f5f5f5; padding: 15px; border-radius: 12px; border: 2px solid #ccc; max-width: 900px; margin: auto;'>"
    
    for r in range(4, -1, -1):
        for c in range(10):
            num = r * 10 + 1 + c if r % 2 == 0 else r * 10 + 10 - c
            
            present_players = ""
            for p_idx in range(st.session_state.board_players):
                if st.session_state.positions[p_idx] == num:
                    present_players += emojis[p_idx]
            
            bg_color = "#ffffff"
            note = ""
            border_style = "1px solid #ddd"
            
            if num == 1:
                bg_color = "#fff9db"
                note = "START"
                border_style = "2px solid #fcc419"
            elif num == 50:
                bg_color = "#e3fafc"
                note = "GOAL"
                border_style = "2px solid #22b8cf"
            elif num in ladders:
                note = f"🪜 ➔ {ladders[num]}"
                bg_color = "#ebfbee"
            elif num in snakes:
                note = f"🐍 ➔ {snakes[num]}"
                bg_color = "#fff5f5"
            
            cell_style = f"background-color: {bg_color}; border: {border_style}; border-radius: 8px; padding: 6px; text-align: center; min-height: 75px; display: flex; flex-direction: column; justify-content: space-between;"
            board_html += f"<div style='{cell_style}'>"
            board_html += f"<div style='font-size: 12px; font-weight: bold; color: #495057; text-align: left;'>{num}</div>"
            board_html += f"<div style='font-size: 18px; margin: 2px 0; min-height: 24px;'>{present_players}</div>"
            board_html += f"<div style='font-size: 9px; color: #868e96; font-weight: bold;'>{note}</div>"
            board_html += "</div>"
            
    board_html += "</div>"
    st.markdown(board_html, unsafe_allow_html=True)

    st.divider()

    cols = st.columns(st.session_state.board_players)
    for i in range(st.session_state.board_players):
        with cols[i]:
            st.metric(label=display_names[i], value=f"{st.session_state.positions[i]}번 칸")

    st.divider()

    if st.session_state.winner:
        st.success(f"🎉 축하합니다! {st.session_state.winner} 팀이 승리했습니다!")
    else:
        st.subheader(f"👉 현재 차례: {display_names[st.session_state.turn]}")
        if st.button("🎲 주사위 던지기", key="roll_dice_btn"):
            dice_roll = random.randint(1, 6)
            old_pos = st.session_state.positions[st.session_state.turn]
            new_pos = old_pos + dice_roll
            log_msg = f"{display_names[st.session_state.turn]}이(가) 주사위 {dice_roll}을(를) 굴렸습니다. ({old_pos} ➔ {new_pos})"
            
            if new_pos >= 50:
                st.session_state.positions[st.session_state.turn] = 50
                st.session_state.winner = display_names[st.session_state.turn]
                st.session_state.log.insert(0, log_msg + " 🏁 골인!!")
            else:
                if new_pos in ladders:
                    log_msg += f" 🪜 사다리! {new_pos}번에서 {ladders[new_pos]}번으로 이동!"
                    new_pos = ladders[new_pos]
                elif new_pos in snakes:
                    log_msg += f" 🐍 뱀이다! {new_pos}번에서 {snakes[new_pos]}번으로 미끄러짐..."
                    new_pos = snakes[new_pos]
                
                st.session_state.positions[st.session_state.turn] = new_pos
                st.session_state.log.insert(0, log_msg)
                st.session_state.turn = (st.session_state.turn + 1) % st.session_state.board_players
            st.rerun()

    if st.button("🔄 게임 처음부터 다시 시작", key="reset_board_btn"):
        st.session_state.positions = [1, 1, 1, 1]
        st.session_state.turn = 0
        st.session_state.log = ["게임을 리셋했습니다!"]
        st.session_state.winner = None
        st.rerun()

    for msg in st.session_state.log[:5]:
        st.write(msg)


# ==========================================
# 4. 쿼리도 두뇌 게임 페이지
# ==========================================
def check_path(start, p_idx, num_p, h_walls, v_walls):
    queue = [start]
    visited = {tuple(start)}
    while queue:
        r, c = queue.pop(0)
        if p_idx == 0 and r == 0: return True
        if p_idx == 1 and r == 8: return True
        if p_idx == 2 and c == 8: return True
        if p_idx == 3 and c == 0: return True
        
        if r > 0 and (r-1, c) not in visited and not h_walls[r-1][c]:
            visited.add((r-1, c))
            queue.append([r-1, c])
        if r < 8 and (r+1, c) not in visited and not h_walls[r][c]:
            visited.add((r+1, c))
            queue.append([r+1, c])
        if c > 0 and (r, c-1) not in visited and not v_walls[r][c-1]:
            visited.add((r, c-1))
            queue.append([r, c-1])
        if c < 8 and (r, c+1) not in visited and not v_walls[r][c]:
            visited.add((r, c+1))
            queue.append([r, c+1])
    return False

def check_all_paths(positions, num_p, h_walls, v_walls):
    for i in range(num_p):
        if not check_path(positions[i], i, num_p, h_walls, v_walls):
            return False
    return True

def quoridor_page():
    st.title("🧱 🧠 전략 두뇌 게임: 쿼리도")
    emojis = ["🔴", "🔵", "🟡", "🟢"]
    
    if "q_players" not in st.session_state: st.session_state.q_players = 2
    if "q_positions" not in st.session_state: st.session_state.q_positions = [[8, 4], [0, 4], [4, 0], [4, 8]]
    if "q_walls_h" not in st.session_state: st.session_state.q_walls_h = [[False]*9 for _ in range(8)]
    if "q_walls_v" not in st.session_state: st.session_state.q_walls_v = [[False]*8 for _ in range(9)]
    if "q_wall_counts" not in st.session_state: st.session_state.q_wall_counts = [10, 10, 5, 5]
    if "q_turn" not in st.session_state: st.session_state.q_turn = 0
    if "q_winner" not in st.session_state: st.session_state.q_winner = None
    if "q_names" not in st.session_state: st.session_state.q_names = ["플레이어 1", "플레이어 2", "플레이어 3", "플레이어 4"]
    if "q_log" not in st.session_state: st.session_state.q_log = ["게임을 시작합니다!"]

    new_num = st.selectbox("참여할 플레이어 수를 선택하세요", [2, 4], index=0 if st.session_state.q_players == 2 else 1, key="q_p_select")
    if new_num != st.session_state.q_players:
        st.session_state.q_players = new_num
        st.session_state.q_positions = [[8, 4], [0, 4], [4, 0], [4, 8]]
        st.session_state.q_walls_h = [[False]*9 for _ in range(8)]
        st.session_state.q_walls_v = [[False]*8 for _ in range(9)]
        st.session_state.q_wall_counts = [10, 10, 5, 5] if new_num == 2 else [5, 5, 5, 5]
        st.session_state.q_turn = 0
        st.session_state.q_winner = None
        st.rerun()

    name_cols = st.columns(st.session_state.q_players)
    for i in range(st.session_state.q_players):
        st.session_state.q_names[i] = name_cols[i].text_input(f"{emojis[i]} 이름", value=st.session_state.q_names[i], key=f"q_name_{i}")

    st.divider()
    
    board_html = "<div style='display: grid; grid-template-columns: repeat(9, 1fr); gap: 0px; background-color: #343a40; padding: 12px; border-radius: 12px; max-width: 450px; margin: auto;'>"
    for r in range(9):
        for c in range(9):
            cell_p = ""
            for p_idx in range(st.session_state.q_players):
                if st.session_state.q_positions[p_idx] == [r, c]: cell_p = emojis[p_idx]
            b_bottom = "2px solid #495057"
            b_right = "2px solid #495057"
            if r < 8 and st.session_state.q_walls_h[r][c]: b_bottom = "6px solid #ff8787"
            if c < 8 and st.session_state.q_walls_v[r][c]: b_right = "6px solid #ff8787"
            bg = "#212529"
            if r == 0: bg = "#2b3b4c"
            elif r == 8: bg = "#4c3b2b"
            cell_style = f"background-color: {bg}; border-bottom: {b_bottom}; border-right: {b_right}; width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 20px;"
            board_html += f"<div style='{cell_style}'>{cell_p}</div>"
    board_html += "</div>"
    st.markdown(board_html, unsafe_allow_html=True)

    st.divider()
    status_cols = st.columns(st.session_state.q_players)
    for i in range(st.session_state.q_players):
        status_cols[i].metric(label=st.session_state.q_names[i], value=f"벽 {st.session_state.q_wall_counts[i]}개")

    if st.session_state.q_winner:
        st.success(f"🎉 {st.session_state.q_winner}님 승리!")
    else:
        curr = st.session_state.q_turn
        st.subheader(f"👉 차례: {emojis[curr]} {st.session_state.q_names[curr]}")
        action = st.radio("행동", ["말 이동", "벽 설치"], horizontal=True, key="q_act")
        cr, cc = st.session_state.q_positions[curr]
        
        if action == "말 이동":
            m_cols = st.columns(4)
            if m_cols[0].button("⬆️ 위", disabled=not (cr > 0 and not st.session_state.q_walls_h[cr-1][cc]), key="qu"):
                st.session_state.q_positions[curr] = [cr-1, cc]
                if curr == 0 and cr-1 == 0: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
            if m_cols[1].button("⬇️ 아래", disabled=not (cr < 8 and not st.session_state.q_walls_h[cr][cc]), key="qd"):
                st.session_state.q_positions[curr] = [cr+1, cc]
                if curr == 1 and cr+1 == 8: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
            if m_cols[2].button("⬅️ 왼쪽", disabled=not (cc > 0 and not st.session_state.q_walls_v[cr][cc-1]), key="ql"):
                st.session_state.q_positions[curr] = [cr, cc-1]
                if curr == 3 and cc-1 == 0: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
            if m_cols[3].button("➡️ 오른쪽", disabled=not (cc < 8 and not st.session_state.q_walls_v[cr][cc]), key="qr"):
                st.session_state.q_positions[curr] = [cr, cc+1]
                if curr == 2 and cc+1 == 8: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
        else:
            w_type = st.selectbox("종류", ["가로 벽", "세로 벽"])
            w_row = st.number_input("행 (1~8)", 1, 8, 1) - 1
            w_col = st.number_input("열 (1~8)", 1, 8, 1) - 1
            if st.button("🧱 벽 설치"):
                ok = False
                if "가로" in w_type:
                    if not st.session_state.q_walls_h[w_row][w_col] and not st.session_state.q_walls_h[w_row][w_col+1]:
                        st.session_state.q_walls_h[w_row][w_col] = True
                        st.session_state.q_walls_h[w_row][w_col+1] = True
                        if check_all_paths(st.session_state.q_positions, st.session_state.q_players, st.session_state.q_walls_h, st.session_state.q_walls_v): ok = True
                        else:
                            st.session_state.q_walls_h[w_row][w_col] = False
                            st.session_state.q_walls_h[w_row][w_col+1] = False
                else:
                    if not st.session_state.q_walls_v[w_row][w_col] and not st.session_state.q_walls_v[w_row+1][w_col]:
                        st.session_state.q_walls_v[w_row][w_col] = True
                        st.session_state.q_walls_v[w_row+1][w_col] = True
                        if check_all_paths(st.session_state.q_positions, st.session_state.q_players, st.session_state.q_walls_h, st.session_state.q_walls_v): ok = True
                        else:
                            st.session_state.q_walls_v[w_row][w_col] = False
                            st.session_state.q_walls_v[w_row+1][w_col] = False
                if ok:
                    st.session_state.q_wall_counts[curr] -= 1
                    st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                    st.rerun()
                else: st.error("벽을 놓을 수 없거나 길을 완전히 막습니다!")


# ==========================================
# 5. RPG 게임 도우미 데이터 & 함수
# ==========================================
SAVE_FILE = "rpg_save_data.json"

# 글로벌 스킬 사전 정의 데이터베이스
ALL_SKILLS = {
    "⚡ 질풍 연격": {"price": 250, "cd": 2, "desc": "신속하게 2단 타격! 공격력의 1.8배 대미지"},
    "🔱 성운 붕괴 폭발": {"price": 850, "cd": 4, "desc": "적 방어력을 100% 무시하고 공격력의 3.2배 고정 대미지"},
    "💖 흡혈귀의 군주": {"price": 500, "cd": 3, "desc": "적에게 1.3배의 피해를 주고, 가한 피해량의 40%만큼 체력 회복"},
    "🛡️ 갓 가디언 실드": {"price": 400, "cd": 3, "desc": "적에게 0.8배 피해를 입히고, 자신의 체력을 60만큼 즉시 치유"},
    "🎯 백발백중 신성창": {"price": 1200, "cd": 3, "desc": "급소를 관통해 공격력의 2.6배 대미지 부여"}
}

def save_rpg():
    data = {
        "lvl": st.session_state.r_lvl,
        "exp": st.session_state.r_exp,
        "max_exp": st.session_state.r_max_exp,
        "gold": st.session_state.r_gold,
        "max_hp": st.session_state.r_max_hp,
        "hp": st.session_state.r_hp,
        "b_atk": st.session_state.r_b_atk,
        "b_def": st.session_state.r_b_def,
        "w_name": st.session_state.r_w_name,
        "w_atk": st.session_state.r_w_atk,
        "w_enhance": st.session_state.r_w_enhance,
        "a_name": st.session_state.r_a_name,
        "a_def": st.session_state.r_a_def,
        "a_enhance": st.session_state.r_a_enhance,
        "skills_owned": st.session_state.r_skills_owned,
        "skills_equipped": st.session_state.r_skills_equipped
    }
    with open(SAVE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def load_rpg():
    if os.path.exists(SAVE_FILE):
        with open(SAVE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        st.session_state.r_lvl = data.get("lvl", 1)
        st.session_state.r_exp = data.get("exp", 0)
        st.session_state.r_max_exp = data.get("max_exp", 10)
        st.session_state.r_gold = data.get("gold", 50)
        st.session_state.r_max_hp = data.get("max_hp", 60)
        st.session_state.r_hp = data.get("hp", 60)
        st.session_state.r_b_atk = data.get("b_atk", 10)
        st.session_state.r_b_def = data.get("b_def", 2)
        st.session_state.r_w_name = data.get("w_name", "낡은 나뭇가지")
        st.session_state.r_w_atk = data.get("w_atk", 0)
        st.session_state.r_w_enhance = data.get("w_enhance", 0)
        st.session_state.r_a_name = data.get("a_name", "천 옷")
        st.session_state.r_a_def = data.get("a_def", 0)
        st.session_state.r_a_enhance = data.get("a_enhance", 0)
        st.session_state.r_skills_owned = data.get("skills_owned", [])
        st.session_state.r_skills_equipped = data.get("skills_equipped", [])
        return True
    return False

def enemy_turn_process(m, total_def):
    # 전장에 장착하고 들어온 스킬들의 개별 쿨타임 관리
    for s_name in st.session_state.r_cds:
        if st.session_state.r_cds[s_name] > 0:
            st.session_state.r_cds[s_name] -= 1

    # 1. 보스 몬스터 사망 판정
    if m["hp"] <= 0:
        st.session_state.r_battle = False
        st.session_state.r_gold += m["gold"]
        st.session_state.r_exp += m["exp"]
        st.session_state.r_log.insert(0, f"🏆 [보스 토벌 대성공] {m['name']} 클리어! 보상: 💰 {m['gold']}G / ✨ {m['exp']}EXP")
        
        # 레벨업 판정
        if st.session_state.r_exp >= st.session_state.r_max_exp:
            st.session_state.r_lvl += 1
            st.session_state.r_exp -= st.session_state.r_max_exp
            st.session_state.r_max_exp = int(st.session_state.r_max_exp * 1.5)
            st.session_state.r_max_hp += 35
            st.session_state.r_b_atk += 8
            st.session_state.r_b_def += 5
            st.session_state.r_hp = st.session_state.r_max_hp
            st.session_state.r_log.insert(0, f"🎉 LEVEL UP! Lv.{st.session_state.r_lvl} 달성! 최대 체력 및 기초 공격/방어 스탯 상승.")
        save_rpg()
        return

    # 2. 보스의 반격 턴
    m_dmg = max(1, m["atk"] - total_def)
    st.session_state.r_hp -= m_dmg
    st.session_state.r_log.insert(0, f"💥 [{m['name']}]의 위협적인 반격! {m_dmg}의 대미지를 입었습니다.")

    # 3. 용사 사망 판정
    if st.session_state.r_hp <= 0:
        st.session_state.r_battle = False
        st.session_state.r_hp = int(st.session_state.r_max_hp * 0.3) # 30% 체력으로 복귀
        p_lost = int(st.session_state.r_gold * 0.1) # 10% 골드 패널티
        st.session_state.r_gold -= p_lost
        st.session_state.r_log.insert(0, f"💀 전사하셨습니다... 안전지대에서 부활했습니다. 패널티로 소지 골드 가치가 감소합니다 (-{p_lost}G)")
        save_rpg()


# ==========================================
# 6. 메인 RPG 게임 화면 페이지
# ==========================================
def rpg_page():
    st.title("⚔️ 전설의 용사 키우기 (Ver 3.0 Custom)")
    st.write("자신만의 스킬셋을 세팅하고 장비를 한계까지 강화하여 10대 군주 보스들을 처단하세요!")

    # 세션 상태 안전 개별 초기화 딕셔너리
    defaults = {
        "r_lvl": 1,
        "r_exp": 0,
        "r_max_exp": 10,
        "r_gold": 100,
        "r_max_hp": 60,
        "r_hp": 60,
        "r_b_atk": 10,
        "r_b_def": 2,
        "r_w_name": "낡은 나뭇가지",
        "r_w_atk": 0,
        "r_w_enhance": 0,
        "r_a_name": "천 옷",
        "r_a_def": 0,
        "r_a_enhance": 0,
        "r_skills_owned": [],
        "r_skills_equipped": [],
        "r_cds": {},
        "r_log": ["새로운 월드에 오신 것을 환영합니다."],
        "r_battle": False,
        "m_cur": None
    }

    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value

    # [💡 고품질 스탯 계산 공식] 강화 수치를 적용한 동적 수치 계산
    # 무기강화당 ATK +8, 방어구강화당 DEF +5 보너스 가산
    enhance_atk_bonus = st.session_state.r_w_enhance * 8
    enhance_def_bonus = st.session_state.r_a_enhance * 5
    
    total_atk = st.session_state.r_b_atk + st.session_state.r_w_atk + enhance_atk_bonus
    total_def = st.session_state.r_b_def + st.session_state.r_a_def + enhance_def_bonus

    # 대시보드 UI 프로필 스탯 노출
    st.subheader("👤 용사 스탯 멀티 정보창")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("종합 레벨", f"Lv.{st.session_state.r_lvl}")
    c2.metric("자금 잔고", f"💰 {st.session_state.r_gold} G")
    
    w_enh_text = f"(+{st.session_state.r_w_enhance})" if st.session_state.r_w_enhance > 0 else ""
    c3.metric("총 공격력", f"⚔️ {total_atk}", f"기본+{st.session_state.r_w_atk} {w_enh_text}")
    
    a_enh_text = f"(+{st.session_state.r_a_enhance})" if st.session_state.r_a_enhance > 0 else ""
    c4.metric("총 방어력", f"🛡️ {total_def}", f"기본+{st.session_state.r_a_def} {a_enh_text}")

    st.write(f"❤️ **HP 게이지:** {st.session_state.r_hp} / {st.session_state.r_max_hp}")
    st.progress(max(0.0, min(1.0, st.session_state.r_hp / st.session_state.r_max_hp)))
    st.write(f"✨ **경험치 잔량:** {st.session_state.r_exp} / {st.session_state.r_max_exp}")
    st.progress(max(0.0, min(1.0, st.session_state.r_exp / st.session_state.r_max_exp)))

    st.divider()

    tab1, tab2, tab3, tab4 = st.tabs([
        "🏹 10대 정예 보스 토벌", 
        "🛒 무기/방어구 대장간 & 강화소", 
        "📜 스킬 커스텀 및 무공 관리실", 
        "💾 모험의 서 파일 입출력"
    ])

    # ------------------------------------------
    # Tab 1: 10마리의 순차적 랜드마크 보스 레이드
    # ------------------------------------------
    with tab1:
        boss_ladder = {
            "👹 [BOSS 01] 하급 슬라임 킹": {"hp": 60, "atk": 12, "def": 2, "exp": 5, "gold": 40},
            "🐺 [BOSS 02] 광포한 우두머리 늑대": {"hp": 180, "atk": 25, "def": 8, "exp": 15, "gold": 120},
            "🦂 [BOSS 03] 사막의 맹독 지배자": {"hp": 450, "atk": 50, "def": 22, "exp": 40, "gold": 300},
            "🧟 [BOSS 04] 저주받은 백골 기사관": {"hp": 1100, "atk": 95, "def": 48, "exp": 90, "gold": 750},
            "🤖 [BOSS 05] 무너진 고대 문명 수호 기갑": {"hp": 2400, "atk": 180, "def": 90, "exp": 200, "gold": 1500},
            "🦅 [BOSS 06] 천공의 오염된 하피 퀸": {"hp": 5000, "atk": 320, "def": 170, "exp": 450, "gold": 3000},
            "🌋 [BOSS 07] 지옥 심연의 용암 고렘": {"hp": 11000, "atk": 540, "def": 310, "exp": 1000, "gold": 5000},
            "❄️ [BOSS 08] 영구 동토의 서리 마녀": {"hp": 24000, "atk": 880, "def": 520, "exp": 2200, "gold": 8000},
            "👑 [BOSS 09] 타락한 황실 영혼 군주": {"hp": 55000, "atk": 1450, "def": 850, "exp": 5000, "gold": 12000},
            "🔥 [BOSS 10] 세계선 종언의 성광 드래곤": {"hp": 120000, "atk": 2500, "def": 1400, "exp": 20000, "gold": 30000}
        }

        if not st.session_state.r_battle:
            st.write("### 🏹 도전할 보스 대상을 선택하십시오:")
            b_choice = st.selectbox("전설급 보스 리스트업", list(boss_ladder.keys()))
            
            equipped_count = len(st.session_state.r_skills_equipped)
            st.info(f"현재 전투용 슬롯에 배치된 스킬 수: **{equipped_count}개** (최대 2개 배치 가능)")
            
            if st.button("⚔️ 보스 결계 룸 진입하기"):
                st.session_state.m_cur = boss_ladder[b_choice].copy()
                st.session_state.m_cur["name"] = b_choice
                st.session_state.m_cur["max_hp"] = boss_ladder[b_choice]["hp"]
                st.session_state.r_battle = True
                
                # 진입 시 전투에 세팅된 스킬의 쿨타임 컴포넌트 초기화
                st.session_state.r_cds = {s: 0 for s in st.session_state.r_skills_equipped}
                st.session_state.r_log.insert(0, f"⚔️ {b_choice}의 진영에 난입했습니다! 生과 死의 전투가 전개됩니다.")
                st.rerun()
        else:
            m = st.session_state.m_cur
            st.error(f"👿 극도로 위협적인 보스 **{m['name']}** 와 혈투 중!")
            st.write(f"💥 **보스 잔여 체력:** {m['hp']} / {m['max_hp']}")
            st.progress(max(0.0, min(1.0, m["hp"] / m["max_hp"])))

            # 장착된 스킬의 개수에 맞춰 다이내믹하게 버튼 가로 레이아웃 배치 (기본 공격 1개 + 장착 스킬 수)
            num_buttons = 1 + len(st.session_state.r_skills_equipped)
            btn_cols = st.columns(num_buttons + 1) # 퇴각 버튼 공간 하나 추가
            
            # 1. 기본 공격 버튼
            if btn_cols[0].button("🗡️ 평타 공격", use_container_width=True):
                p_dmg = max(1, total_atk - m["def"])
                m["hp"] -= p_dmg
                st.session_state.r_log.insert(0, f"⚔️ 용사의 일격! [{m['name']}]에게 {p_dmg}의 대미지 적중.")
                enemy_turn_process(m, total_def)
                st.rerun()

            # 2. 유저가 커스텀하게 장착하고 들어온 스킬 버튼들 동적 배치
            for idx, s_name in enumerate(st.session_state.r_skills_equipped):
                cd_val = st.session_state.r_cds.get(s_name, 0)
                btn_label = f"{s_name}"
                if cd_val > 0:
                    btn_label += f" ({cd_val}턴 대기)"
                
                is_disabled = cd_val > 0
                if btn_cols[idx + 1].button(btn_label, disabled=is_disabled, use_container_width=True):
                    # 각 스킬 이름별 실시간 메커니즘 연산식 분기 처리
                    p_dmg = 0
                    log_text = ""
                    
                    if s_name == "⚡ 질풍 연격":
                        p_dmg = max(1, int(total_atk * 1.8) - m["def"])
                        log_text = f"⚡ [질풍 연격 시전] 신속하게 두 번 베어 {p_dmg}의 큰 대미지를 날렸습니다!"
                    elif s_name == "🔱 성운 붕괴 폭발":
                        p_dmg = int(total_atk * 3.2) # 방어 100% 무시
                        log_text = f"🔱 [성운 붕괴 폭발 시전] 장갑을 완전 무시하고 {p_dmg}의 치명적 고정 피해를 선사했습니다!"
                    elif s_name == "💖 흡혈귀의 군주":
                        p_dmg = max(1, int(total_atk * 1.3) - m["def"])
                        heal_amt = int(p_dmg * 0.4)
                        st.session_state.r_hp = min(st.session_state.r_max_hp, st.session_state.r_hp + heal_amt)
                        log_text = f"💖 [흡혈귀의 군주 시전] 적에게 {p_dmg} 피해를 입히고 내 체력을 +{heal_amt} 흡수했습니다!"
                    elif s_name == "🛡️ 갓 가디언 실드":
                        p_dmg = max(1, int(total_atk * 0.8) - m["def"])
                        st.session_state.r_hp = min(st.session_state.r_max_hp, st.session_state.r_hp + 60)
                        log_text = f"🛡️ [갓 가디언 실드 시전] 방어막을 쳐 {p_dmg} 피해를 주고 체력을 즉시 +60 치유했습니다."
                    elif s_name == "🎯 백발백중 신성창":
                        p_dmg = max(1, int(total_atk * 2.6) - m["def"])
                        log_text = f"🎯 [백발백중 신성창 시전] 적의 급소에 일격을 꽂아 {p_dmg}의 치명타를 주었습니다."
                    
                    m["hp"] -= p_dmg
                    st.session_state.r_cds[s_name] = ALL_SKILLS[s_name]["cd"]
                    st.session_state.r_log.insert(0, log_text)
                    enemy_turn_process(m, total_def)
                    st.rerun()

            # 마지막 칸 퇴각 단추 배치
            if btn_cols[-1].button("🏃 도망치기", use_container_width=True):
                st.session_state.r_battle = False
                st.session_state.r_log.insert(0, "💨 위협적인 기운에 밀려 전투에서 이탈했습니다.")
                st.rerun()

    # ------------------------------------------
    # Tab 2: 상점 보급소 & 장비 인챈트 강화 시스템
    # ------------------------------------------
    with tab2:
        st.subheader("🛒 최고급 장비 보급 대장간")
        st.write("골드를 지불해 더욱 강력한 등급의 장비를 영구 교체 획득할 수 있습니다.")
        
        # 10,000원 아이템을 종결로 하는 균형 잡힌 무기 상점 데이터
        w_shop = [
            {"name": "⚔️ 단단한 정련 철검", "atk": 20, "price": 150},
            {"name": "🔱 마력을 주입한 창", "atk": 65, "price": 600},
            {"name": "☄️ 성광의 천공 대검", "atk": 160, "price": 2000},
            {"name": "🔥 드래곤 오리진 슬레이어", "atk": 380, "price": 5000},
            {"name": "🌌 종언을 고하는 창조의 검", "atk": 850, "price": 10000}
        ]
        
        # 10,000원 아이템을 종결로 하는 균형 잡힌 방어구 상점 데이터
        a_shop = [
            {"name": "🧥 야전 이중 가죽갑옷", "def": 10, "price": 180},
            {"name": "⛓️ 팔라딘 중전 사슬갑", "def": 35, "price": 650},
            {"name": "🔱 티타늄 풀플레이트 아머", "def": 90, "price": 2200},
            {"name": "🌌 오로라 불멸의 성해 아머", "def": 210, "price": 5200},
            {"name": "👑 절대존엄 성황의 천신갑", "def": 480, "price": 10000}
        ]

        st.write(f"현재 무기: **{st.session_state.r_w_name}** | 현재 방어구: **{st.session_state.r_a_name}**")
        
        w_tab, a_tab, enh_tab = st.tabs(["⚔️ 무기 상점", "🛡️ 방어구 상점", "💎 장비 강화소"])
        
        with w_tab:
            wc = st.columns(len(w_shop))
            for i, w in enumerate(w_shop):
                with wc[i]:
                    st.write(f"**{w['name']}**")
                    st.caption(f"공격력 +{w['atk']}")
                    if st.button(f"구매 💰{w['price']}G", key=f"buy_w_{i}"):
                        if st.session_state.r_gold >= w['price']:
                            st.session_state.r_gold -= w['price']
                            st.session_state.r_w_name = w['name']
                            st.session_state.r_w_atk = w['atk']
                            st.session_state.r_w_enhance = 0 # 새 무기 장착 시 강화도 초기화
                            st.session_state.r_log.insert(0, f"🛒 무기를 [{w['name']}]으로 전면 교체 장착했습니다.")
                            save_rpg()
                            st.rerun()
                        else: st.error("소지 골드가 부족합니다.")
                        
        with a_tab:
            ac = st.columns(len(a_shop))
            for i, a in enumerate(a_shop):
                with ac[i]:
                    st.write(f"**{a['name']}**")
                    st.caption(f"방어력 +{a['def']}")
                    if st.button(f"구매 💰{a['price']}G", key=f"buy_a_{i}"):
                        if st.session_state.r_gold >= a['price']:
                            st.session_state.r_gold -= a['price']
                            st.session_state.r_a_name = a['name']
                            st.session_state.r_a_def = a['def']
                            st.session_state.r_a_enhance = 0 # 새 방어구 장착 시 강화도 초기화
                            st.session_state.r_log.insert(0, f"🛒 방어구를 [{a['name']}]으로 전면 교체 착용했습니다.")
                            save_rpg()
                            st.rerun()
                        else: st.error("소지 골드가 부족합니다.")

        # [🔥 신규 핵심 기능] 장비 주문서 골드 강화 시스템 단락
        with enh_tab:
            st.write("### 💎 축복받은 장비 인챈트 제단")
            st.write("보유하고 있는 주무기와 방어구에 골드를 헌사하여 추가 한계 강화를 진행합니다.")
            st.warning("⚠️ 주의: 새 장비를 구매하면 기존 장비의 주문서 강화 수치는 사라지고 계승되지 않습니다!")
            
            # 강화 비용 공식: (현재강화레벨 + 1) * 200 골드 균형 패치
            w_cost = (st.session_state.r_w_enhance + 1) * 200
            a_cost = (st.session_state.r_a_enhance + 1) * 200
            
            ec1, ec2 = st.columns(2)
            with ec1:
                st.write(f"#### 무기 강화: (+{st.session_state.r_w_enhance}) ➔ (+{st.session_state.r_w_enhance+1})")
                st.caption(f"강화 보너스 효과: 총 공격력 **+8 추가 상승**")
                if st.button(f"⚔️ 무기 강화하기 (💰 {w_cost} G)", use_container_width=True):
                    if st.session_state.r_gold >= w_cost:
                        st.session_state.r_gold -= w_cost
                        # 85% 확률 성공 시스템 탑재 (실패해도 무기가 부서지지는 않고 골드만 소모되어 안전)
                        if random.random() < 0.85:
                            st.session_state.r_w_enhance += 1
                            st.session_state.r_log.insert(0, f"✨ [강화 대성공] 무기가 더욱 날카로워져 (+{st.session_state.r_w_enhance})강 상태가 되었습니다!")
                        else:
                            st.session_state.r_log.insert(0, f"❌ [강화 실패] 제단의 기류가 불안정하여 강화에 실패했습니다. (장비 손상 없음)")
                        save_rpg()
                        st.rerun()
                    else: st.error("강화 비용 골드가 모자랍니다.")

            with ec2:
                st.write(f"#### 방어구 강화: (+{st.session_state.r_a_enhance}) ➔ (+{st.session_state.r_a_enhance+1})")
                st.caption(f"강화 보너스 효과: 총 방어력 **+5 추가 상승**")
                if st.button(f"🛡️ 방어구 강화하기 (💰 {a_cost} G)", use_container_width=True):
                    if st.session_state.r_gold >= a_cost:
                        st.session_state.r_gold -= a_cost
                        if random.random() < 0.85:
                            st.session_state.r_a_enhance += 1
                            st.session_state.r_log.insert(0, f"✨ [강화 대성공] 방어구가 강화되어 (+{st.session_state.r_a_enhance})강 코팅이 완료되었습니다!")
                        else:
                            st.session_state.r_log.insert(0, f"❌ [강화 실패] 제단의 충격 완화에 실패하여 강화도가 유지되었습니다.")
                        save_rpg()
                        st.rerun()
                    else: st.error("강화 비용 골드가 모자랍니다.")

        st.divider()
        if st.button("💖 성수 엘릭서 캔 드링크 (전체 회복) | 💰 20 G"):
            if st.session_state.r_gold >= 20:
                if st.session_state.r_hp == st.session_state.r_max_hp:
                    st.warning("이미 활력이 가득 차 있어 복용이 불가능합니다.")
                else:
                    st.session_state.r_gold -= 20
                    st.session_state.r_hp = st.session_state.r_max_hp
                    st.session_state.r_log.insert(0, "🧪 엘릭서 수액을 마시고 컨디션을 완전히 충전했습니다.")
                    save_rpg()
                    st.rerun()
            else: st.error("골드가 부족합니다.")

    # ------------------------------------------
    # Tab 3: 스킬 구매 및 동적 장착/해제 세팅실
    # ------------------------------------------
    with tab3:
        st.subheader("📜 영웅 무공 비급 구매소")
        st.write("새로운 고위 마법 및 물리 연격 기술들을 구매해 도서관에 보관하세요.")
        
        sc = st.columns(len(ALL_SKILLS))
        for idx, (s_name, s_info) in enumerate(ALL_SKILLS.items()):
            with sc[idx]:
                st.write(f"**{s_name}**")
                st.caption(s_info["desc"])
                st.caption(f"쿨타임: {s_info['cd']}턴")
                
                if s_name in st.session_state.r_skills_owned:
                    st.success("보유 중")
                else:
                    if st.button(f"배우기 💰{s_info['price']}G", key=f"learn_{idx}"):
                        if st.session_state.r_gold >= s_info["price"]:
                            st.session_state.r_gold -= s_info["price"]
                            st.session_state.r_skills_owned.append(s_name)
                            st.session_state.r_log.insert(0, f"📜 비급서 무공 고찰 완료! [{s_name}]을 습득했습니다.")
                            save_rpg()
                            st.rerun()
                        else: st.error("골드가 부족하여 비급을 구매하지 못했습니다.")

        st.divider()
        st.subheader("🛡️ 실시간 전투 무기 커스텀 세팅 (스킬 장착실)")
        st.write("보유한 비급 목록 중 **최대 2개**를 선택하여 전투 퀵슬롯에 직접 세팅할 수 있습니다.")
        
        if not st.session_state.r_skills_owned:
            st.info("아직 습득한 스킬이 존재하지 않습니다. 상단에서 스킬을 먼저 연마해보세요!")
        else:
            st.write(f"현재 장착 완료된 스킬 덱: `{st.session_state.r_skills_equipped}`")
            
            manage_cols = st.columns(len(st.session_state.r_skills_owned))
            for idx, owned_s in enumerate(st.session_state.r_skills_owned):
                with manage_cols[idx]:
                    st.write(f"**{owned_s}**")
                    
                    if owned_s in st.session_state.r_skills_equipped:
                        if st.button("❌ 장착 해제", key=f"unequip_{idx}", use_container_width=True):
                            st.session_state.r_skills_equipped.remove(owned_s)
                            st.session_state.r_log.insert(0, f"⚙️ 전투 슬롯에서 [{owned_s}]을(를) 탈거했습니다.")
                            save_rpg()
                            st.rerun()
                    else:
                        # 2개 꽉 찬 경우 버튼 비활성화 조치
                        slot_full = len(st.session_state.r_skills_equipped) >= 2
                        if st.button("➕ 스킬 장착", key=f"equip_{idx}", disabled=slot_full, use_container_width=True):
                            st.session_state.r_skills_equipped.append(owned_s)
                            st.session_state.r_log.insert(0, f"⚙️ 전투 슬롯 퀵창에 [{owned_s}]을(를) 커스텀 빌드했습니다.")
                            save_rpg()
                            st.rerun()

    # ------------------------------------------
    # Tab 4: 파일 시스템 백업 아카이빙 세션
    # ------------------------------------------
    with tab4:
        st.write("### 💾 영웅 모험 기록 데이터베이스 파일 입출력")
        sm1, sm2 = st.columns(2)
        if sm1.button("💾 데이터 수동 저장하기 (Save)"):
            save_rpg()
            st.success("강화 수치와 보유 및 장착 스킬 테이블이 안전하게 파일 인코딩 저장되었습니다.")
        if sm2.button("📂 데이터 원격 불러오기 (Load)"):
            if load_rpg():
                st.success("모험의 서 세이브 패키지를 전방위 로드하는 데 성공했습니다!")
                st.rerun()
            else: st.error("매칭되는 백업 세이브 데이터 파일(.json)이 식별되지 않습니다.")

    st.divider()
    st.write("### 📜 전투 상황실 하이라이트 배틀로그")
    for log in st.session_state.r_log[:5]:
        st.write(log)


# ==========================================
# 7. 메인 네비게이션 진입 게이트웨이
# ==========================================
st.set_page_config(
    page_title="종합 게임 허브 스트림릿",
    page_icon="🌟",
    layout="wide"
)

home = st.Page(home_page, title="홈 화면", icon="🌟")
game = st.Page(game_page, title="업다운 게임", icon="🎮")
board = st.Page(board_page, title="뱀사다리 말판 게임", icon="🎲")
quoridor = st.Page(quoridor_page, title="쿼리도 두뇌 게임", icon="🧱")
rpg = st.Page(rpg_page, title="성장형 RPG 게임", icon="⚔️")

pg = st.navigation([home, game, board, quoridor, rpg])
pg.run()
